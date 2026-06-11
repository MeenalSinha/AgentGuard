"""
ML-based failure prediction using scikit-learn LinearRegression + IsolationForest.
Trains per-agent models from 30-day metric history.
Replaces polynomial decay formula with real statistical inference.
"""
import asyncio
import numpy as np
from datetime import datetime, timedelta
import structlog

from app.core.celery import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.services.prediction_service.refresh_all_predictions")
def refresh_all_predictions():
    asyncio.run(_refresh())


async def _refresh():
    from app.core.database import AsyncSessionLocal
    from app.models.models import Agent
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Agent).where(Agent.is_active == True))
        agents = res.scalars().all()

    for agent in agents:
        try:
            await _predict_for_agent(agent)
        except Exception as e:
            logger.error("Prediction failed", agent=str(agent.id), error=str(e))

    logger.info("Predictions refreshed", count=len(agents))


async def _predict_for_agent(agent):
    from app.core.database import AsyncSessionLocal
    from app.models.models import AgentMetric, Prediction
    from sqlalchemy import select, delete
    from sklearn.linear_model import LinearRegression
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    import warnings
    warnings.filterwarnings("ignore")

    async with AsyncSessionLocal() as db:
        since = datetime.utcnow() - timedelta(days=30)
        res = await db.execute(
            select(AgentMetric)
            .where(AgentMetric.agent_id == agent.id, AgentMetric.timestamp >= since)
            .order_by(AgentMetric.timestamp)
        )
        metrics = res.scalars().all()

        if len(metrics) < 10:
            return  # Not enough data for meaningful ML

        # Build feature matrix
        t = np.arange(len(metrics)).reshape(-1, 1)  # time index
        accuracy     = np.array([m.accuracy or agent.accuracy for m in metrics])
        drift        = np.array([m.drift_score or agent.drift_score for m in metrics])
        halluc       = np.array([m.hallucination_rate or agent.hallucination_rate for m in metrics])
        latency      = np.array([m.latency_ms or agent.avg_latency_ms for m in metrics])
        trust        = np.array([m.trust_score or agent.trust_score for m in metrics])

        # Delete stale predictions
        await db.execute(delete(Prediction).where(Prediction.agent_id == agent.id))

        now = datetime.utcnow()
        preds_to_add = []

        # ── 1. Trust Score degradation forecast (Linear Regression) ──────────
        scaler = StandardScaler()
        t_scaled = scaler.fit_transform(t)
        lr = LinearRegression()
        lr.fit(t_scaled, trust)

        # Forecast next 72 hours (24 points at 3h intervals)
        future_steps = 24
        future_t = np.arange(len(metrics), len(metrics) + future_steps).reshape(-1, 1)
        future_t_scaled = scaler.transform(future_t)
        trust_forecast = lr.predict(future_t_scaled)

        # Residuals for uncertainty bands
        trust_resid_std = np.std(trust - lr.predict(t_scaled))
        forecast_data = [
            {
                "hours_ahead": i * 3,
                "value":  float(np.clip(trust_forecast[i], 0, 100)),
                "lower":  float(np.clip(trust_forecast[i] - 1.96 * trust_resid_std, 0, 100)),
                "upper":  float(np.clip(trust_forecast[i] + 1.96 * trust_resid_std, 0, 100)),
            }
            for i in range(future_steps)
        ]

        # Probability = how much trust is projected to drop in 48h
        trust_48h = float(np.clip(trust_forecast[16], 0, 100))
        trust_drop = max(0, float(trust[-1]) - trust_48h)
        quality_prob = min(0.95, max(0.05, trust_drop / float(trust[-1])))

        if quality_prob > 0.15:
            preds_to_add.append(Prediction(
                agent_id=agent.id,
                prediction_type="quality_degradation",
                probability=round(quality_prob, 3),
                time_horizon_hours=48,
                description=(
                    f"LinearRegression model (trained on {len(metrics)} samples) projects trust score "
                    f"declining from {trust[-1]:.1f} to {trust_48h:.1f} over 48 hours "
                    f"(slope={lr.coef_[0]:.4f}/step, R²={lr.score(t_scaled, trust):.3f})."
                ),
                confidence=round(min(0.95, 0.60 + abs(lr.coef_[0]) * 10), 3),
                features_used=["trust_score", "accuracy_trend", "time_index"],
                forecast_data=forecast_data,
                created_at=now,
                expires_at=now + timedelta(hours=24),
            ))

        # ── 2. Drift forecast (Linear Regression on drift_score) ─────────────
        lr_drift = LinearRegression()
        lr_drift.fit(t_scaled, drift)
        drift_48h_idx = 16
        drift_48h_val = float(np.clip(lr_drift.predict(future_t_scaled[drift_48h_idx:drift_48h_idx+1])[0], 0, 1))
        drift_increase = max(0, drift_48h_val - float(drift[-1]))
        drift_prob = min(0.95, max(0.05, drift_increase * 4))

        if drift_prob > 0.20 or float(drift[-1]) > 0.15:
            drift_forecast = [
                {
                    "hours_ahead": i * 3,
                    "value":  float(np.clip(lr_drift.predict(future_t_scaled[i:i+1])[0] * 100, 0, 100)),
                    "lower":  float(np.clip(lr_drift.predict(future_t_scaled[i:i+1])[0] * 100 * 0.85, 0, 100)),
                    "upper":  float(np.clip(lr_drift.predict(future_t_scaled[i:i+1])[0] * 100 * 1.15, 0, 100)),
                }
                for i in range(future_steps)
            ]
            preds_to_add.append(Prediction(
                agent_id=agent.id,
                prediction_type="drift",
                probability=round(drift_prob, 3),
                time_horizon_hours=72,
                description=(
                    f"Drift score regression (R²={lr_drift.score(t_scaled, drift):.3f}) projects "
                    f"continued increase from {drift[-1]:.3f} to {drift_48h_val:.3f} within 48h "
                    f"based on current {drift_increase*100:.1f}% trend trajectory."
                ),
                confidence=round(min(0.93, 0.55 + drift_increase * 3), 3),
                features_used=["drift_score", "accuracy_trend", "time_index"],
                forecast_data=drift_forecast,
                created_at=now,
                expires_at=now + timedelta(hours=24),
            ))

        # ── 3. Anomaly detection (IsolationForest) ────────────────────────────
        X = np.column_stack([accuracy, drift, halluc, latency / 1000])
        iso = IsolationForest(contamination=0.1, random_state=42, n_estimators=50)
        scores = iso.fit_predict(X)
        anomaly_rate = float(np.mean(scores == -1))

        if anomaly_rate > 0.12:
            preds_to_add.append(Prediction(
                agent_id=agent.id,
                prediction_type="anomaly",
                probability=round(min(0.90, anomaly_rate * 3), 3),
                time_horizon_hours=24,
                description=(
                    f"IsolationForest (n_estimators=50) detected anomalous behavior in {anomaly_rate:.0%} "
                    f"of recent metric samples. Multi-variate outlier pattern suggests elevated failure risk "
                    f"in the next 24 hours."
                ),
                confidence=round(min(0.88, 0.60 + anomaly_rate), 3),
                features_used=["accuracy", "drift_score", "hallucination_rate", "latency_ms"],
                forecast_data=[],
                created_at=now,
                expires_at=now + timedelta(hours=12),
            ))

        # ── 4. Hallucination spike (if rate trending up) ─────────────────────
        if len(halluc) >= 10:
            lr_halluc = LinearRegression()
            lr_halluc.fit(t_scaled, halluc)
            halluc_48h = float(np.clip(lr_halluc.predict(future_t_scaled[drift_48h_idx:drift_48h_idx+1])[0], 0, 1))
            halluc_increase = max(0, halluc_48h - float(halluc[-1]))
            halluc_prob = min(0.95, max(0.05, halluc_increase * 8))

            if halluc_prob > 0.25:
                preds_to_add.append(Prediction(
                    agent_id=agent.id,
                    prediction_type="hallucination",
                    probability=round(halluc_prob, 3),
                    time_horizon_hours=24,
                    description=(
                        f"Hallucination rate regression projects increase from {halluc[-1]*100:.2f}% "
                        f"to {halluc_48h*100:.2f}% within 24h. "
                        f"Rate trend coefficient={lr_halluc.coef_[0]:.5f}/step."
                    ),
                    confidence=round(min(0.92, 0.58 + halluc_increase * 4), 3),
                    features_used=["hallucination_rate", "drift_score", "accuracy"],
                    forecast_data=[],
                    created_at=now,
                    expires_at=now + timedelta(hours=12),
                ))

        for p in preds_to_add:
            db.add(p)
        await db.commit()
        logger.info("Predictions updated", agent=agent.name, count=len(preds_to_add))
