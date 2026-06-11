from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "agentguard",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.services.drift_service",
        "app.services.hallucination_service",
        "app.services.prediction_service",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "scan-agents-every-minute": {
            "task": "app.services.drift_service.periodic_drift_scan",
            "schedule": 60.0,
        },
        "refresh-predictions-hourly": {
            "task": "app.services.prediction_service.refresh_all_predictions",
            "schedule": 3600.0,
        },
    },
)
