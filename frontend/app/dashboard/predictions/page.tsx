"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { predictionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface ForecastPoint { hours_ahead: number; value: number; lower: number; upper: number; }
interface Prediction {
  id: string; agent_id: string; prediction_type: string; probability: number;
  time_horizon_hours: number; description: string; confidence: number;
  features_used: string[]; forecast_data: ForecastPoint[]; created_at: string;
  agent_name?: string;
}

const PROB_COLOR = (p: number) => p >= 0.75 ? "#ef4444" : p >= 0.55 ? "#f97316" : "#eab308";
const TYPE_LABELS: Record<string,string> = { quality_degradation:"Quality Degradation", hallucination:"Hallucination Spike", drift:"Drift", latency:"Latency Regression" };

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">+{label}h</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.stroke }}>{p.name}:</span>
          <span className="text-hi">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function PredictionsPage() {
  const [preds, setPreds]   = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await predictionsApi.list({ limit: "50" });
      setPreds(res.data || []);
      if (res.data?.length) setSelected(res.data[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pred = preds.find(p => p.id === selected);

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Failure Prediction Engine</h1>
        <p className="text-[11px] text-lo mt-0.5">ML-based forecasting to identify agents at risk before users are impacted</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Predictions", value: preds.length, color:"text-hi" },
          { label: "High Risk (>70%)",   value: preds.filter(p=>p.probability>=0.7).length, color:"text-danger" },
          { label: "Avg Confidence",     value: preds.length ? `${(preds.reduce((a,p)=>a+p.confidence,0)/preds.length*100).toFixed(0)}%` : "—", color:"text-lime" },
          { label: "Shortest Horizon",   value: preds.length ? `${Math.min(...preds.map(p=>p.time_horizon_hours))}h` : "—", color:"text-orange" },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }} className="card p-4">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* List + chart */}
      <div className="grid grid-cols-3 gap-4">
        {/* List */}
        <div className="card overflow-hidden">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest px-5 py-4 border-b border-border">Predictions</div>
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight:540 }}>
            {loading && Array.from({length:4}).map((_,i)=>(
              <div key={i} className="px-5 py-4 opacity-40"><div className="h-10 bg-surface rounded animate-pulse" /></div>
            ))}
            {!loading && preds.length===0 && (
              <div className="px-5 py-10 text-center text-lo text-[12px]">No predictions — seed database first</div>
            )}
            {preds.map(p => (
              <div key={p.id} onClick={()=>setSelected(p.id)}
                className={cn("px-5 py-4 cursor-pointer transition-colors", selected===p.id?"bg-surface":"hover:bg-surface")}>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor:PROB_COLOR(p.probability) }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-hi truncate">{p.agent_name || p.agent_id?.slice(0,10)}</div>
                    <div className="text-[10px] text-lo mt-0.5">{TYPE_LABELS[p.prediction_type] || p.prediction_type}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${p.probability*100}%`, backgroundColor:PROB_COLOR(p.probability) }} />
                      </div>
                      <span className="text-[11px] font-mono font-black" style={{ color:PROB_COLOR(p.probability) }}>{(p.probability*100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[10px] text-lo mt-1">Within {p.time_horizon_hours}h · {(p.confidence*100).toFixed(0)}% conf</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forecast chart + detail */}
        <div className="col-span-2 space-y-3">
          {pred ? (
            <motion.div key={pred.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <div className="card p-5 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[13px] font-bold text-hi">{pred.agent_name || pred.agent_id?.slice(0,10)}</div>
                  <span className="text-[16px] font-black font-mono" style={{ color:PROB_COLOR(pred.probability) }}>
                    {(pred.probability*100).toFixed(0)}% probability
                  </span>
                </div>
                <p className="text-[11px] text-mid mb-4">{pred.description}</p>
                <div className="text-[10px] text-lo uppercase tracking-wider mb-3">Trust Score Forecast — next {pred.time_horizon_hours}h</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={pred.forecast_data}>
                    <defs>
                      <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PROB_COLOR(pred.probability)} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={PROB_COLOR(pred.probability)} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hours_ahead" tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} domain={[50,100]} />
                    <Tooltip content={<Tip />} />
                    <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Area type="monotone" dataKey="value" stroke={PROB_COLOR(pred.probability)} strokeWidth={2} fill="url(#fGrad)" name="Forecast" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <div className="text-[10px] font-bold text-hi uppercase tracking-wider mb-3">Features Used in Prediction</div>
                <div className="flex flex-wrap gap-2">
                  {pred.features_used?.map(f => (
                    <span key={f} className="text-[10px] px-3 py-1 bg-raised border border-border text-mid rounded-full font-mono">{f}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="card flex items-center justify-center text-lo text-[12px]" style={{ minHeight:300 }}>
              {loading ? "Loading predictions..." : "Select a prediction to view forecast"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
