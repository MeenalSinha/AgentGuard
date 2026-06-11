"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agentsApi, investigationApi } from "@/lib/api";
import { cn, getTrustColor, getStatusBadgeClass } from "@/lib/utils";

interface GraphNode { id: string; label: string; description: string; }
interface GraphEdge { from: string; to: string; condition: string | null; }
interface GraphStructure { nodes: GraphNode[]; edges: GraphEdge[]; entry_point: string; description: string; }
interface InvResult {
  status: string; incident_created: boolean; incident_id?: string;
  root_cause: string; root_cause_category: string; confidence_score: number;
  severity: string; recommended_actions: string[]; estimated_improvements: string[];
  notification_sent: boolean; phoenix_traces_analyzed: number; metrics_analyzed: number; error?: string;
}

const NODE_X: Record<string, number> = {
  gather_evidence: 40, fetch_phoenix_traces: 220, analyze_with_gemini: 400, create_incident: 580, notify_operator: 760,
};
const NODE_COLORS: Record<string, string> = {
  gather_evidence: "#60a5fa", fetch_phoenix_traces: "#a78bfa",
  analyze_with_gemini: "#f97316", create_incident: "#a8e63d", notify_operator: "#f472b6",
};
const SEV_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#60a5fa" };

export default function InvestigationPage() {
  const [agents, setAgents]       = useState<any[]>([]);
  const [selAgent, setSelAgent]   = useState<any>(null);
  const [graph, setGraph]         = useState<GraphStructure | null>(null);
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<InvResult | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [doneNodes, setDoneNodes] = useState<string[]>([]);
  const [triggerType, setTriggerType] = useState("model_drift");
  const [severity, setSeverity]   = useState("high");

  useEffect(() => {
    agentsApi.list({ limit: "20" }).then(r => {
      setAgents(r.data || []);
      if (r.data?.length) setSelAgent(r.data[0]);
    }).catch(() => {});
    investigationApi.graphStructure().then(r => setGraph(r.data)).catch(() => {});
  }, []);

  const runInvestigation = useCallback(async () => {
    if (!selAgent || running) return;
    setRunning(true);
    setResult(null);
    setDoneNodes([]);

    // Animate through nodes while waiting for real result
    const nodes = graph?.nodes.map(n => n.id) || [];
    const animInterval = 1800;
    nodes.forEach((nodeId, i) => {
      setTimeout(() => { setActiveNode(nodeId); setDoneNodes(prev => [...prev, ...nodes.slice(0, i)]); }, i * animInterval);
    });

    try {
      const res = await investigationApi.triggerSync(
        selAgent.id, triggerType, severity,
        `Manual investigation triggered for ${selAgent.name} — ${triggerType.replace(/_/g, " ")}`
      );
      setResult(res.data);
    } catch (e: any) {
      setResult({
        status: "error", incident_created: false, root_cause: "Backend not connected — start the FastAPI server",
        root_cause_category: "infrastructure", confidence_score: 0, severity: "low",
        recommended_actions: ["Start backend: uvicorn app.main:app --reload"],
        estimated_improvements: [], notification_sent: false,
        phoenix_traces_analyzed: 0, metrics_analyzed: 0,
        error: e?.message,
      });
    } finally {
      setRunning(false);
      setActiveNode(null);
      setDoneNodes(graph?.nodes.map(n => n.id) || []);
    }
  }, [selAgent, running, graph, triggerType, severity]);

  const TRIGGER_OPTIONS = [
    "model_drift", "retrieval_drift", "prompt_drift", "hallucination_surge",
    "latency_spike", "safety_violation", "cost_explosion", "tool_failure",
  ];

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">LangGraph Investigation Engine</h1>
        <p className="text-[11px] text-lo mt-0.5">
          Autonomous 5-node investigation graph — detect → gather evidence → Gemini RCA → create incident → notify operator
        </p>
      </div>

      {/* Graph visualization */}
      {graph && (
        <div className="card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Investigation Graph</div>
          <div className="relative overflow-x-auto py-4">
            <svg width="940" height="120" className="w-full drop-shadow-md">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {/* Edges */}
              {graph.edges.slice(0, 5).map((edge, i) => {
                const x1 = (NODE_X[edge.from] || 0) + 130;
                const x2 = NODE_X[edge.to] || 700;
                const y = 55;
                const isDone = doneNodes.includes(edge.from) && doneNodes.includes(edge.to);
                return (
                  <g key={i}>
                    <motion.line x1={x1} y1={y} x2={x2} y2={y}
                      stroke={isDone ? "#a8e63d" : "rgba(255,255,255,0.15)"}
                      strokeWidth={isDone ? 2.5 : 1.5}
                      strokeDasharray={edge.condition ? "5 3" : "none"}
                      animate={{ stroke: isDone ? "#a8e63d" : "rgba(255,255,255,0.15)" }}
                      transition={{ duration: 0.5 }}
                    />
                    <polygon points={`${x2},${y} ${x2-8},${y-4} ${x2-8},${y+4}`}
                      fill={isDone ? "#a8e63d" : "rgba(255,255,255,0.25)"} />
                  </g>
                );
              })}
              {/* Nodes */}
              {graph.nodes.map((node) => {
                const x = NODE_X[node.id] || 60;
                const isActive = activeNode === node.id;
                const isDone   = doneNodes.includes(node.id);
                const color    = NODE_COLORS[node.id] || "#a8e63d";
                return (
                  <g key={node.id} transform={`translate(${x}, 30)`}>
                    <motion.rect x={0} y={0} width={130} height={50} rx={10}
                      fill={isDone ? `${color}25` : isActive ? `${color}20` : "rgba(255,255,255,0.06)"}
                      stroke={isDone ? color : isActive ? color : "rgba(255,255,255,0.15)"}
                      strokeWidth={isDone || isActive ? 1.5 : 1}
                      filter={(isDone || isActive) ? "url(#glow)" : "none"}
                      animate={{ stroke: isDone ? color : isActive ? color : "rgba(255,255,255,0.15)" }}
                      transition={{ duration: 0.4 }}
                    />
                    {isActive && (
                      <motion.rect x={0} y={0} width={130} height={50} rx={10} fill="none"
                        stroke={color} strokeWidth={2} opacity={0.6}
                        animate={{ opacity: [0.6, 0, 0.6] }} transition={{ duration: 1.2, repeat: Infinity }} />
                    )}
                    <text x={65} y={22} textAnchor="middle" fill={isDone ? color : isActive ? "#ffffff" : "#d4d4d8"}
                      fontSize={11} fontWeight={isDone || isActive ? "700" : "600"}
                      className="drop-shadow-sm">
                      {isDone ? "✓ " : isActive ? "● " : ""}{node.label.split(" ")[0]}
                    </text>
                    <text x={65} y={36} textAnchor="middle" fill={isDone ? color : isActive ? color : "#a1a1aa"}
                      fontSize={9} fontWeight="500">
                      {node.label.split(" ").slice(1).join(" ")}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-[10px] text-lo mt-2">{graph.description}</p>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        {/* Agent picker */}
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">Target Agent</div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {agents.slice(0, 10).map(a => (
              <button key={a.id} onClick={() => setSelAgent(a)}
                className={cn("w-full text-left px-3 py-2 rounded-xl text-[11px] transition-all border",
                  selAgent?.id === a.id ? "border-lime/40 text-hi" : "border-border text-mid hover:text-hi hover:border-ring"
                )}
                style={selAgent?.id === a.id ? { background: "rgba(168,230,61,0.07)" } : { background: "var(--color-background-secondary)" }}>
                <div className="font-medium">{a.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] font-mono font-black", getTrustColor(a.trust_score))}>{a.trust_score.toFixed(0)}</span>
                  <span className={cn("text-[10px] capitalize", a.status === "healthy" ? "text-lime" : a.status === "warning" ? "text-orange" : "text-danger")}>{a.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger config */}
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">Trigger Configuration</div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-lo mb-1.5">Trigger Type</div>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
                className="w-full bg-raised border border-border rounded-xl px-3 py-2 text-[11px] text-hi outline-none">
                {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-lo mb-1.5">Severity</div>
              <div className="grid grid-cols-2 gap-1.5">
                {["low", "medium", "high", "critical"].map(s => (
                  <button key={s} onClick={() => setSeverity(s)}
                    className={cn("py-1.5 rounded-lg text-[10px] capitalize font-medium border transition-all",
                      severity === s ? "text-hi border-current" : "text-lo border-border hover:text-hi")}
                    style={severity === s ? { background: `${SEV_COLORS[s]}18`, borderColor: `${SEV_COLORS[s]}60`, color: SEV_COLORS[s] } : {}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <motion.button onClick={runInvestigation} disabled={!selAgent || running}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl font-bold text-[12px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: running ? "rgba(168,230,61,0.08)" : "#1a1a1a",
                color: "#a8e63d", border: "1px solid rgba(168,230,61,0.35)",
              }}>
              {running ? "Running LangGraph..." : "Run Investigation"}
            </motion.button>
          </div>
        </div>

        {/* Graph node status */}
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">Node Status</div>
          <div className="space-y-2">
            {(graph?.nodes || []).map(node => {
              const isActive = activeNode === node.id;
              const isDone   = doneNodes.includes(node.id);
              const color    = NODE_COLORS[node.id] || "#a8e63d";
              return (
                <div key={node.id} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0"
                    style={{
                      background: isDone ? `${color}22` : isActive ? `${color}18` : "rgba(255,255,255,0.04)",
                      borderColor: isDone ? color : isActive ? color : "rgba(255,255,255,0.1)",
                      color: isDone ? color : isActive ? color : "#52525b",
                    }}>
                    {isDone ? "✓" : isActive ? <motion.span animate={{ opacity: [1,0.3,1] }} transition={{ duration:0.7, repeat:Infinity }}>●</motion.span> : "○"}
                  </div>
                  <div>
                    <div className="text-[10px] font-medium" style={{ color: isDone ? color : isActive ? color : "#a1a1aa" }}>{node.label}</div>
                    {isActive && <div className="text-[9px] text-lo">Running...</div>}
                    {isDone && <div className="text-[9px] text-lime">Complete</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Result panel */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Summary */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Investigation Result</div>
                <div className="flex items-center gap-2">
                  {result.incident_created && (
                    <span className="badge badge-healthy">Incident Created</span>
                  )}
                  {result.notification_sent && (
                    <span className="badge badge-healthy">Slack Notified</span>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(168,230,61,0.1)", color: "#a8e63d", border: "1px solid rgba(168,230,61,0.2)" }}>
                    Confidence: {(result.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Root Cause Category</div>
                  <div className="text-[12px] text-hi font-medium capitalize">{result.root_cause_category}</div>
                </div>
                <div className="bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Severity</div>
                  <div className="text-[12px] font-medium capitalize" style={{ color: SEV_COLORS[result.severity] || "#a1a1aa" }}>{result.severity}</div>
                </div>
                <div className="col-span-2 bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Root Cause (Gemini Generated)</div>
                  <div className="text-[12px] text-hi leading-relaxed">{result.root_cause}</div>
                </div>
                <div className="bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Phoenix Traces Analyzed</div>
                  <div className="text-[18px] font-black text-lime">{result.phoenix_traces_analyzed}</div>
                </div>
                <div className="bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Metric Samples Analyzed</div>
                  <div className="text-[18px] font-black text-lime">{result.metrics_analyzed}</div>
                </div>
              </div>
            </div>

            {/* Recommended actions */}
            {result.recommended_actions?.length > 0 && (
              <div className="card p-5">
                <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-3">Recommended Actions</div>
                <div className="space-y-2">
                  {result.recommended_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ background: "rgba(168,230,61,0.04)", borderColor: "rgba(168,230,61,0.18)" }}>
                      <span className="text-[10px] font-bold text-lime shrink-0 mt-0.5 font-mono">{String(i+1).padStart(2,"0")}</span>
                      <span className="text-[11px] text-hi leading-relaxed flex-1">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estimated improvements */}
            {result.estimated_improvements?.length > 0 && (
              <div className="card p-5">
                <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-3">Estimated Improvements</div>
                <div className="flex flex-wrap gap-2">
                  {result.estimated_improvements.map((imp, i) => (
                    <span key={i} className="text-[11px] px-3 py-1.5 rounded-xl border text-hi"
                      style={{ background: "rgba(168,230,61,0.06)", borderColor: "rgba(168,230,61,0.2)" }}>
                      {imp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.error && (
              <div className="card p-4 border border-danger/20">
                <div className="text-[10px] text-danger uppercase tracking-wider mb-1">Note</div>
                <div className="text-[11px] text-mid">{result.error}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
