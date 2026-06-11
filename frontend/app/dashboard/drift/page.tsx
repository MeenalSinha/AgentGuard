"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { driftApi } from "@/lib/api";
import { cn, getSeverityClass, timeAgo, severityDotColor } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell } from "recharts";

interface DriftEvent {
  id: string; agent_id: string; drift_type: string; severity: string;
  confidence: number; description: string; baseline_value: number;
  current_value: number; delta: number; resolved: boolean; created_at: string;
  agent_name?: string;
}
interface DriftSummaryRow { drift_type: string; severity: string; count: number; }

const TYPE_COLOR: Record<string, string> = { prompt: "#a8e63d", model: "#f97316", retrieval: "#60a5fa", user_intent: "#c084fc" };
const SEV_COLOR: Record<string, string>  = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#60a5fa" };
const TYPE_FILTERS = ["all", "prompt", "model", "retrieval", "user_intent"];

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.fill || "#a8e63d" }}>{p.name}:</span>
          <span className="text-hi">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DriftPage() {
  const [events, setEvents]   = useState<DriftEvent[]>([]);
  const [summary, setSummary] = useState<DriftSummaryRow[]>([]);
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [evRes, sumRes] = await Promise.all([driftApi.list(), driftApi.summary()]);
      setEvents(evRes.data || []);
      setSummary(sumRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build bar-chart data from summary
  const barData = ["prompt", "model", "retrieval", "user_intent"].map(t => ({
    type: t.replace("_", " "),
    active:   summary.filter(r => r.drift_type === t && r.severity !== "low").reduce((s, r) => s + r.count, 0),
    resolved: summary.filter(r => r.drift_type === t).reduce((s, r) => s + r.count, 0),
  }));

  // Radar from summary
  const radarData = [
    { subject: "Prompt",   score: Math.max(0, 100 - (summary.filter(r => r.drift_type==="prompt").reduce((s,r)=>s+r.count,0)*8)) },
    { subject: "Model",    score: Math.max(0, 100 - (summary.filter(r => r.drift_type==="model").reduce((s,r)=>s+r.count,0)*8)) },
    { subject: "Retrieval",score: Math.max(0, 100 - (summary.filter(r => r.drift_type==="retrieval").reduce((s,r)=>s+r.count,0)*8)) },
    { subject: "Intent",   score: Math.max(0, 100 - (summary.filter(r => r.drift_type==="user_intent").reduce((s,r)=>s+r.count,0)*8)) },
    { subject: "Safety",   score: 90 },
  ];

  const filtered = filter === "all" ? events : events.filter(e => e.drift_type === filter);
  const active   = events.filter(e => !e.resolved);

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Drift Detection Engine</h1>
        <p className="text-[11px] text-lo mt-0.5">Real-time behavioral drift analysis across your AI fleet</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Events",    value: active.length,                                                          color: "text-danger" },
          { label: "Critical / High",  value: active.filter(e => e.severity==="critical"||e.severity==="high").length, color: "text-orange" },
          { label: "Agents Affected",  value: new Set(active.map(e => e.agent_id)).size,                              color: "text-hi" },
          { label: "Resolved",         value: events.filter(e => e.resolved).length,                                  color: "text-lime" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.05 }} className="card p-4">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Events by Drift Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="active" name="Active" maxBarSize={32} radius={[4,4,0,0]}>
                {barData.map((d, i) => <Cell key={i} fill={Object.values(TYPE_COLOR)[i] || "#a8e63d"} />)}
              </Bar>
              <Bar dataKey="resolved" name="Total" fill="#2a2a2a" maxBarSize={32} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Health Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 9 }} />
              <Radar dataKey="score" stroke="#a8e63d" fill="#a8e63d" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Events list */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Drift Events</div>
          <div className="pill-nav">
            {TYPE_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("pill-nav-item capitalize", filter===f && "active")}>
                {f.replace("_"," ")}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {loading && Array.from({length:4}).map((_,i) => (
            <div key={i} className="px-5 py-4 opacity-40"><div className="h-4 bg-surface rounded animate-pulse" /></div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-lo text-[12px]">No drift events — seed data or connect agents</div>
          )}
          {filtered.map((ev, i) => (
            <motion.div key={ev.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.03 }}
              className="px-5 py-4 hover:bg-surface transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: SEV_COLOR[ev.severity] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="text-[12px] font-semibold text-hi">{ev.agent_name || ev.agent_id.slice(0,8)}</span>
                    <span className="badge" style={{ color: TYPE_COLOR[ev.drift_type], background: TYPE_COLOR[ev.drift_type]+"18", border: `1px solid ${TYPE_COLOR[ev.drift_type]}33` }}>
                      {ev.drift_type.replace("_"," ")}
                    </span>
                    <span className={cn("text-[11px] capitalize", getSeverityClass(ev.severity))}>{ev.severity}</span>
                    {ev.resolved && <span className="badge badge-healthy">Resolved</span>}
                  </div>
                  <p className="text-[11px] text-mid leading-relaxed">{ev.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="text-[10px] text-lo">Baseline: <span className="text-mid">{ev.baseline_value?.toFixed(3)}</span></span>
                    <span className="text-[10px] text-lo">Current: <span className="text-mid">{ev.current_value?.toFixed(3)}</span></span>
                    <span className="text-[10px] text-lo">Delta: <span className={ev.delta < 0 ? "text-danger" : "text-lime"}>{ev.delta > 0 ? "+" : ""}{ev.delta?.toFixed(3)}</span></span>
                    <span className="text-[10px] text-lo">Confidence: <span className="text-hi">{(ev.confidence*100).toFixed(0)}%</span></span>
                    <span className="text-[10px] text-lo ml-auto">{timeAgo(ev.created_at)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
