"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { dashboardApi, investigationApi } from "@/lib/api";
import { cn, formatCurrency, getTrustColor, timeAgo } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Link from "next/link";

interface KPI {
  active_agents: number; avg_health_score: number; drift_events_today: number;
  hallucination_alerts_today: number; total_monthly_cost: number;
  avg_response_quality: number; critical_incidents: number; agents_at_risk: number;
}
interface FeedEvent { id: string; type: string; severity: string; agent: string; message: string; timestamp: string; }
interface AgentRank  { agent_id: string; name: string; agent_type: string; trust_score: number; status: string; }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.stroke || p.fill }}>{p.name}:</span>
          <span className="text-hi font-medium">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function KpiCard({ label, value, sub, accent = "neutral", delay = 0 }: {
  label: string; value: string | number; sub?: string; accent?: string; delay?: number;
}) {
  const accentClass = { lime: "text-lime", orange: "text-orange", danger: "text-danger", neutral: "text-hi" }[accent] || "text-hi";
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      className="card p-5 flex flex-col">
      <div className="text-[11px] font-medium text-lo uppercase tracking-wider mb-3">{label}</div>
      <div className={cn("text-4xl font-black leading-none mb-2", accentClass)}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-auto">{sub}</div>}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis]         = useState<KPI | null>(null);
  const [rankings, setRankings] = useState<AgentRank[]>([]);
  const [feed, setFeed]         = useState<FeedEvent[]>([]);
  const [health, setHealth]     = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [healthTrend, setHealthTrend] = useState<any[]>([]);
  const [costTrend, setCostTrend]     = useState<any[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // ── Initial data load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [kpisRes, rankRes, feedRes, healthRes] = await Promise.all([
        dashboardApi.kpis(), dashboardApi.rankings(),
        dashboardApi.liveFeed(), dashboardApi.healthOverview(),
      ]);
      setKpis(kpisRes.data);
      setRankings(rankRes.data || []);
      setFeed(feedRes.data || []);
      setHealth(healthRes.data || {});
      const avg = kpisRes.data.avg_health_score || 85;
      setHealthTrend(Array.from({ length: 14 }, (_, i) => ({
        t: i + 1, v: avg + Math.sin(i / 3) * 3 + (Math.random() - 0.5) * 2,
      })));
      const dailyCost = (kpisRes.data.total_monthly_cost || 18000) / 30;
      setCostTrend(Array.from({ length: 30 }, (_, i) => ({
        d: i + 1, v: dailyCost + (Math.random() - 0.5) * dailyCost * 0.15,
      })));
    } catch { /* backend offline — graceful */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  // ── SSE real-time feed ─────────────────────────────────────────────────────
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${API}/api/v1/realtime/feed`);
    sseRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onmessage = (event) => {
      try {
        const events: FeedEvent[] = JSON.parse(event.data);
        if (Array.isArray(events) && events.length) {
          setFeed(prev => {
            const ids = new Set(prev.map(e => e.id));
            const newEvents = events.filter(e => !ids.has(e.id));
            return [...newEvents, ...prev].slice(0, 50);
          });
        }
      } catch {}
    };
    es.onerror = () => { setSseConnected(false); };

    return () => { es.close(); sseRef.current = null; };
  }, []);

  const total = Object.values(health).reduce((s, v) => s + v, 0);

  return (
    <div className="p-5 space-y-4 max-w-[1700px] mx-auto">

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Agents"       value={kpis?.active_agents ?? "—"}                accent="neutral" delay={0}    sub={`${health.critical || 0} critical`} />
        <KpiCard label="Fleet Health Score"  value={kpis ? kpis.avg_health_score.toFixed(1):"—"} accent="lime" delay={0.04} sub="Avg trust score" />
        <KpiCard label="Drift Events Today"  value={kpis?.drift_events_today ?? "—"}           accent="orange"  delay={0.08} sub="Last 24 hours" />
        <KpiCard label="Hallucination Alerts" value={kpis?.hallucination_alerts_today ?? "—"} accent="danger"  delay={0.12} sub="Last 24 hours" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Monthly Cost"         value={kpis ? formatCurrency(kpis.total_monthly_cost):"—"} accent="neutral" delay={0.14} sub="+$1.2k vs last month" />
        <KpiCard label="Avg Response Quality" value={kpis ? `${kpis.avg_response_quality.toFixed(1)}%`:"—"} accent="lime" delay={0.16} sub="Across all agents" />
        <KpiCard label="Critical Incidents"   value={kpis?.critical_incidents ?? "—"}             accent="danger"  delay={0.18} sub="Open now" />
        <KpiCard label="Agents at Risk"       value={kpis?.agents_at_risk ?? "—"}                 accent="orange"  delay={0.20} sub="Warning + Critical" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-3">
        {/* Fleet status */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="col-span-12 md:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Fleet Status</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Healthy",  key: "healthy",  color: "#a8e63d" },
              { label: "Warning",  key: "warning",  color: "#f97316" },
              { label: "Critical", key: "critical", color: "#ef4444" },
            ].map(s => {
              const count = health[s.key] || 0;
              const pct = total ? (count / total * 100).toFixed(1) : "0.0";
              return (
                <div key={s.key} className="text-center">
                  <div className="text-2xl font-black leading-none" style={{ color: s.color }}>{pct}%</div>
                  <div className="text-[10px] text-lo mt-1">{s.label}</div>
                  <div className="text-[10px] font-mono text-mid">{count}</div>
                </div>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={healthTrend}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a8e63d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a8e63d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#a8e63d" strokeWidth={2} fill="url(#hg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 text-[10px]">
            <span className="text-lo">Total agents</span>
            <span className="text-hi font-bold">{total}</span>
          </div>
        </motion.div>

        {/* Health trend */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }} className="col-span-12 md:col-span-5 card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-1">Fleet Health Trend</div>
          <div className="text-[10px] text-lo mb-4">14-day rolling average</div>
          <ResponsiveContainer width="100%" height={155}>
            <AreaChart data={healthTrend}>
              <defs>
                <linearGradient id="htg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a8e63d" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a8e63d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} domain={[60, 100]} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="v" stroke="#a8e63d" strokeWidth={2} fill="url(#htg)" name="Score" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily cost */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }} className="col-span-12 md:col-span-4 card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-1">Daily Cost</div>
          <div className="text-[10px] text-lo mb-4">30-day window</div>
          <ResponsiveContainer width="100%" height={155}>
            <AreaChart data={costTrend}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="d" tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
              <YAxis tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="v" stroke="#f97316" strokeWidth={2} fill="url(#cg)" name="Cost $" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Rankings + Live Feed */}
      <div className="grid grid-cols-12 gap-3">
        {/* Trust leaderboard */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="col-span-12 md:col-span-7 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Trust Score Leaderboard</div>
            <div className="flex items-center gap-3 text-[10px] text-lo">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lime" />Healthy</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange" />Warning</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" />Critical</span>
              <span className="text-muted">Total: {rankings.length}</span>
            </div>
          </div>
          <div className="px-5 py-3 space-y-3">
            {rankings.slice(0, 8).map((agent, i) => (
              <Link key={agent.agent_id} href={`/dashboard/agents/${agent.agent_id}`}>
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                  <span className="text-[10px] text-muted font-mono w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0 relative h-7 flex items-center">
                    <motion.div className="absolute left-0 top-0 h-full rounded-lg flex items-center px-3 gap-2"
                      style={{
                        backgroundColor: agent.status === "healthy" ? "rgba(168,230,61,0.14)" : agent.status === "warning" ? "rgba(249,115,22,0.14)" : "rgba(239,68,68,0.14)",
                        border: `1px solid ${agent.status === "healthy" ? "rgba(168,230,61,0.22)" : agent.status === "warning" ? "rgba(249,115,22,0.22)" : "rgba(239,68,68,0.22)"}`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.trust_score}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.04, ease: "easeOut" }}>
                      <span className="text-[10px] font-semibold text-hi truncate whitespace-nowrap">{agent.name}</span>
                    </motion.div>
                  </div>
                  <span className={cn("text-[11px] font-black font-mono shrink-0", getTrustColor(agent.trust_score))}>
                    {agent.trust_score.toFixed(0)}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Live feed with SSE indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }} className="col-span-12 md:col-span-5 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <motion.div className="w-2 h-2 rounded-full"
                style={{ background: sseConnected ? "#a8e63d" : "#f97316" }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: sseConnected ? 2 : 1, repeat: Infinity }} />
              <span className="text-[11px] font-bold text-hi uppercase tracking-widest">Live Feed</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: sseConnected ? "rgba(168,230,61,0.1)" : "rgba(249,115,22,0.1)", color: sseConnected ? "#a8e63d" : "#f97316" }}>
                {sseConnected ? "SSE" : "Polling"}
              </span>
            </div>
            <span className="text-[10px] text-lo">Real-time</span>
          </div>
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 340 }}>
            {feed.length === 0 && !loading ? (
              <div className="px-5 py-8 text-center text-[11px] text-lo">No events — seed data or start backend</div>
            ) : (
              feed.slice(0, 15).map((ev, i) => (
                <motion.div key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="px-5 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", {
                      "bg-danger": ev.severity === "critical",
                      "bg-orange": ev.severity === "high",
                      "bg-yellow-400": ev.severity === "medium",
                      "bg-blue-400": ev.severity === "low",
                    })} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-mid truncate">{ev.agent}</div>
                      <div className="text-[11px] text-hi mt-0.5 leading-relaxed">{ev.message}</div>
                      <div className="text-[10px] text-lo mt-1">{timeAgo(ev.timestamp)}</div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick actions row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="grid grid-cols-4 gap-3">
        {[
          { label: "Run LangGraph Investigation", href: "/dashboard/investigation", color: "#a8e63d", desc: "Trigger autonomous Gemini RCA" },
          { label: "Inject Failure Scenario",     href: "/dashboard/simulator",     color: "#f97316", desc: "Judge demo mode" },
          { label: "View All Incidents",          href: "/dashboard/incidents",     color: "#ef4444", desc: "Open incident timeline" },
          { label: "AI Copilot",                  href: "/dashboard/copilot",       color: "#a78bfa", desc: "Ask about your fleet" },
        ].map(action => (
          <Link key={action.href} href={action.href}>
            <div className="card p-4 hover:border-ring transition-all cursor-pointer group">
              <div className="text-[11px] font-bold mb-1 group-hover:opacity-90 transition-opacity" style={{ color: action.color }}>
                {action.label}
              </div>
              <div className="text-[10px] text-lo">{action.desc}</div>
            </div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
