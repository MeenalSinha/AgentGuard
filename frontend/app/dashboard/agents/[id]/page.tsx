"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { agentsApi } from "@/lib/api";
import { cn, getTrustColor, getStatusBadgeClass, formatMs, formatCurrency, agentTypeLabel } from "@/lib/utils";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

interface Agent { id: string; name: string; agent_type: string; status: string; trust_score: number; accuracy: number; relevance: number; avg_latency_ms: number; cost_per_query: number; total_cost_month: number; user_satisfaction: number; drift_score: number; total_conversations: number; hallucination_rate: number; owner: string; environment: string; model_name: string; }
interface Metric { timestamp: string; accuracy: number; relevance: number; latency_ms: number; cost: number; trust_score: number; conversation_count: number; hallucination_rate: number; }

const TABS = ["Overview", "Metrics", "Drift", "Incidents", "Recommendations"];

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.stroke || "#a8e63d" }}>{p.name}:</span>
          <span className="text-hi">{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AgentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([agentsApi.get(id), agentsApi.metrics(id, period)])
      .then(([aRes, mRes]) => { setAgent(aRes.data); setMetrics(mRes.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, period]);

  if (loading) return <div className="flex items-center justify-center h-64 text-lo text-sm">Loading agent data...</div>;
  if (!agent) return <div className="flex items-center justify-center h-64 text-danger text-sm">Agent not found</div>;

  const radarData = [
    { subject: "Accuracy",     score: agent.accuracy * 100 },
    { subject: "Relevance",    score: agent.relevance * 100 },
    { subject: "Safety",       score: Math.max(0, (1 - agent.hallucination_rate * 8) * 100) },
    { subject: "Speed",        score: Math.max(10, 100 - agent.avg_latency_ms / 30) },
    { subject: "Satisfaction", score: agent.user_satisfaction * 100 },
    { subject: "Stability",    score: (1 - agent.drift_score) * 100 },
  ];

  const mFmt = metrics.map((m, i) => ({ i, ...m, ts: new Date(m.timestamp).toLocaleDateString() }));

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-lo">
        <Link href="/dashboard/agents" className="hover:text-hi transition-colors">Agents</Link>
        <span>/</span><span className="text-hi">{agent.name}</span>
      </div>

      {/* Agent header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black",
            agent.status === "healthy" ? "bg-lime/10 text-lime" : agent.status === "warning" ? "bg-orange/10 text-orange" : "bg-danger/10 text-danger"
          )}>{agent.name[0]}</div>
          <div>
            <h1 className="text-xl font-black text-hi">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-lo">
              <span>{agentTypeLabel(agent.agent_type)}</span><span>·</span>
              <span>{agent.owner}</span><span>·</span>
              <span className="capitalize">{agent.environment}</span><span>·</span>
              <span className="font-mono">{agent.model_name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={getStatusBadgeClass(agent.status)}>{agent.status}</span>
          <span className={cn("text-3xl font-black font-mono", getTrustColor(agent.trust_score))}>{agent.trust_score.toFixed(1)}</span>
        </div>
      </div>

      {/* Quick metrics row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: "Accuracy", value: `${(agent.accuracy*100).toFixed(1)}%`, color: "text-lime" },
          { label: "Relevance", value: `${(agent.relevance*100).toFixed(1)}%`, color: "text-lime" },
          { label: "Halluc. Rate", value: `${(agent.hallucination_rate*100).toFixed(2)}%`, color: agent.hallucination_rate > 0.05 ? "text-danger" : "text-lime" },
          { label: "Avg Latency", value: formatMs(agent.avg_latency_ms), color: "text-hi" },
          { label: "Monthly Cost", value: formatCurrency(agent.total_cost_month), color: "text-hi" },
          { label: "Conversations", value: agent.total_conversations.toLocaleString(), color: "text-hi" },
        ].map(m => (
          <div key={m.label} className="card p-4">
            <div className="text-[10px] text-lo uppercase tracking-wider mb-1">{m.label}</div>
            <div className={cn("text-xl font-black", m.color)}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="pill-nav w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("pill-nav-item", tab === t && "active")}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Trust gauge */}
          <div className="card p-5 flex flex-col items-center justify-center">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-4">Trust Score</div>
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a2a" strokeWidth="10" />
                <motion.circle cx="50" cy="50" r="42" fill="none"
                  stroke={agent.trust_score >= 90 ? "#a8e63d" : agent.trust_score >= 75 ? "#f97316" : "#ef4444"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*42}`}
                  initial={{ strokeDashoffset: `${2*Math.PI*42}` }}
                  animate={{ strokeDashoffset: `${2*Math.PI*42*(1-agent.trust_score/100)}` }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-black", getTrustColor(agent.trust_score))}>{agent.trust_score.toFixed(0)}</span>
                <span className="text-[10px] text-lo">/ 100</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-lo text-center">
              {agent.trust_score >= 90 ? "Excellent" : agent.trust_score >= 75 ? "Needs attention" : "Critical"}
            </div>
          </div>
          {/* Radar */}
          <div className="card p-5">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-3">Performance Radar</div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 9 }} />
                <Radar dataKey="score" stroke="#a8e63d" fill="#a8e63d" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Drift indicator */}
          <div className="card p-5">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-4">Drift Score</div>
            <div className={cn("text-5xl font-black mb-3", agent.drift_score > 0.2 ? "text-danger" : agent.drift_score > 0.1 ? "text-orange" : "text-lime")}>
              {(agent.drift_score * 100).toFixed(0)}%
            </div>
            <div className="progress-track mb-3">
              <motion.div className="progress-bar" style={{ width: `${agent.drift_score*100}%`, backgroundColor: agent.drift_score > 0.2 ? "#ef4444" : agent.drift_score > 0.1 ? "#f97316" : "#a8e63d" }} initial={{ width: 0 }} animate={{ width: `${agent.drift_score*100}%` }} transition={{ duration: 1 }} />
            </div>
            <div className="text-[11px] text-lo">{agent.drift_score < 0.05 ? "No significant drift detected" : agent.drift_score < 0.15 ? "Minor drift — monitor closely" : "Significant drift — action required"}</div>
          </div>
        </div>
      )}

      {tab === "Metrics" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="pill-nav">
              {(["24h", "7d", "30d"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={cn("pill-nav-item", period === p && "active")}>{p}</button>
              ))}
            </div>
            <span className="text-[11px] text-lo">{mFmt.length} data points</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "accuracy", label: "Accuracy", color: "#a8e63d" },
              { key: "trust_score", label: "Trust Score", color: "#f97316" },
              { key: "latency_ms", label: "Latency (ms)", color: "#60a5fa" },
              { key: "hallucination_rate", label: "Hallucination Rate", color: "#ef4444" },
            ].map(chart => (
              <div key={chart.key} className="card p-5">
                <div className="text-[11px] text-lo uppercase tracking-wider mb-4">{chart.label}</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={mFmt}>
                    <defs>
                      <linearGradient id={`g_${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chart.color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ts" tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(mFmt.length / 6))} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} fill={`url(#g_${chart.key})`} name={chart.label} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {(tab === "Drift" || tab === "Incidents" || tab === "Recommendations") && (
        <div className="card p-8 text-center text-lo text-[12px]">
          Agent-specific {tab.toLowerCase()} loaded from live API — seed the database first:<br />
          <code className="bg-surface px-2 py-0.5 rounded font-mono text-[11px] mt-2 inline-block">python -m app.scripts.seed_demo_data</code>
        </div>
      )}
    </div>
  );
}
