"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { agentsApi } from "@/lib/api";
import { cn, getTrustColor, getStatusBadgeClass, formatMs, formatCurrency, agentTypeLabel } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";

interface Agent {
  id: string; name: string; agent_type: string; status: string;
  trust_score: number; accuracy: number; relevance: number;
  avg_latency_ms: number; cost_per_query: number; total_cost_month: number;
  user_satisfaction: number; drift_score: number; total_conversations: number;
  hallucination_rate: number; owner: string; environment: string; model_name: string;
}

const STATUS_TABS = ["all", "healthy", "warning", "critical"];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (status !== "all") params.status = status;
      const res = await agentsApi.list(params);
      setAgents(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: agents.length,
    healthy: agents.filter(a => a.status === "healthy").length,
    warning: agents.filter(a => a.status === "warning").length,
    critical: agents.filter(a => a.status === "critical").length,
  };

  return (
    <div className="p-5 space-y-4 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Agent Monitoring Center</h1>
          <p className="text-[11px] text-lo mt-0.5">Monitor and manage your entire AI agent fleet</p>
        </div>
        <button 
          className="text-[11px] font-bold bg-lime text-black px-4 py-2 rounded-btn hover:opacity-90 transition-opacity"
          onClick={() => toast("Agent registration flow is mocked for this demo", { icon: "🚧", style: { background: "#18181b", color: "#fff", border: "1px solid #a8e63d" } })}
        >
          + Register Agent
        </button>
      </div>

      {/* Filter bar — pill tabs matching reference image */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="pill-nav">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => setStatus(s)} className={cn("pill-nav-item capitalize", status === s && "active")}>
              {s === "all" ? "All" : s}
              <span className={cn("ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                s === "healthy" ? "bg-lime/20 text-lime" : s === "warning" ? "bg-orange/20 text-orange" : s === "critical" ? "bg-danger/20 text-danger" : "bg-surface text-lo"
              )}>{counts[s as keyof typeof counts]}</span>
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="filter-pill bg-transparent outline-none text-hi placeholder:text-lo w-48"
          style={{ background: "#1a1a1a" }}
        />
        <div className="ml-auto text-[11px] text-lo">{filtered.length} agents</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.all, color: "text-hi" },
          { label: "Healthy", value: counts.healthy, color: "text-lime" },
          { label: "Warning",  value: counts.warning, color: "text-orange" },
          { label: "Critical", value: counts.critical, color: "text-danger" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-lo">
                {["Agent", "Status", "Trust Score", "Accuracy", "Halluc. Rate", "Latency", "Monthly Cost", "Drift", "Conversations", ""].map(h => (
                  <th key={h} className={cn("px-4 py-3 font-medium uppercase tracking-wider text-[10px]", h === "" || h === "Trust Score" || h === "Accuracy" || h === "Halluc. Rate" || h === "Latency" || h === "Monthly Cost" || h === "Drift" || h === "Conversations" ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="opacity-40">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="h-4 bg-surface rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025 }}
                  className="hover:bg-surface transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0",
                        a.status === "healthy" ? "bg-lime/10 text-lime" : a.status === "warning" ? "bg-orange/10 text-orange" : "bg-danger/10 text-danger"
                      )}>{a.name[0]}</div>
                      <div>
                        <div className="font-semibold text-hi">{a.name}</div>
                        <div className="text-lo text-[10px]">{agentTypeLabel(a.agent_type)} · {a.environment}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={getStatusBadgeClass(a.status)}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.trust_score}%`, backgroundColor: a.trust_score >= 90 ? "#a8e63d" : a.trust_score >= 75 ? "#f97316" : "#ef4444" }} />
                      </div>
                      <span className={cn("font-mono font-black text-[12px]", getTrustColor(a.trust_score))}>{a.trust_score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-hi">{(a.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(a.hallucination_rate > 0.05 ? "text-danger" : a.hallucination_rate > 0.02 ? "text-orange" : "text-lime")}>
                      {(a.hallucination_rate * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-mid">{formatMs(a.avg_latency_ms)}</td>
                  <td className="px-4 py-3 text-right text-mid">{formatCurrency(a.total_cost_month)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(a.drift_score > 0.2 ? "text-danger" : a.drift_score > 0.1 ? "text-orange" : "text-lime")}>
                      {(a.drift_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-mid">{a.total_conversations.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/agents/${a.id}`} className="text-lime hover:text-lime/80 font-semibold text-[11px]">View →</Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
