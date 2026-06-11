"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { observabilityApi, investigationApi } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";

interface PhoenixStatus { connected: boolean; endpoint: string; }

export default function ObservabilityPage() {
  const [status, setStatus]       = useState<PhoenixStatus | null>(null);
  const [traces, setTraces]       = useState<any[]>([]);
  const [graphStructure, setGraph] = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const [sRes, gRes] = await Promise.all([
        observabilityApi.status(),
        investigationApi.graphStructure(),
      ]);
      setStatus(sRes.data);
      setGraph(gRes.data);
      if (sRes.data.connected) {
        const tRes = await observabilityApi.traces(20);
        setTraces(tRes.data?.traces || tRes.data?.data || []);
      }
    } catch { /* backend offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const NODE_COLORS: Record<string, string> = {
    gather_evidence: "#60a5fa", fetch_phoenix_traces: "#a78bfa",
    analyze_with_gemini: "#f97316", create_incident: "#a8e63d", notify_operator: "#f472b6",
  };

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Observability</h1>
        <p className="text-[11px] text-lo mt-0.5">Arize Phoenix integration · LangGraph trace graph · OTEL spans</p>
      </div>

      {/* Phoenix status */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-5">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">Arize Phoenix</div>
          <div className="flex items-center gap-3 mb-3">
            <motion.div className="w-3 h-3 rounded-full shrink-0"
              style={{ background: status?.connected ? "#a8e63d" : "#ef4444" }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: status?.connected ? 2 : 0.8, repeat: Infinity }} />
            <span className={cn("text-[13px] font-bold", status?.connected ? "text-lime" : "text-danger")}>
              {loading ? "Checking..." : status?.connected ? "Connected" : "Offline"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-lo">{status?.endpoint || "http://localhost:6006"}</div>
          {status?.connected && (
            <a href={status.endpoint} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-3 text-[10px] text-lime hover:text-lime/80 underline">
              Open Phoenix UI →
            </a>
          )}
          {!status?.connected && !loading && (
            <div className="mt-3 text-[10px] text-lo">
              Start: <code className="bg-raised px-1.5 py-0.5 rounded font-mono">docker compose up -d phoenix</code>
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">OTEL Configuration</div>
          <div className="space-y-2 text-[10px] font-mono">
            {[
              ["Endpoint",     "/v1/traces"],
              ["Project",      "agentguard"],
              ["Service",      "agentguard-backend"],
              ["Exporter",     "OTLP HTTP"],
              ["Processor",    "BatchSpanProcessor"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-lo">{k}</span>
                <span className="text-hi">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[10px] uppercase tracking-widest text-lo mb-3">SDK Instrumentation</div>
          <div className="text-[10px] text-mid leading-relaxed mb-3">
            Instrument any agent in 3 lines — every invocation creates a Phoenix span:
          </div>
          <pre className="text-[9px] font-mono bg-raised rounded-xl p-3 text-lime overflow-x-auto">{`from app.sdk.instrument import AgentGuardMonitor

monitor = AgentGuardMonitor(
  agent_id="your-agent-uuid",
  agent_name="My Agent"
)

with monitor.trace(query) as ctx:
    response = llm.invoke(query)
    ctx.record_response(response)
# → Span sent to Phoenix`}</pre>
        </div>
      </div>

      {/* LangGraph graph diagram */}
      {graphStructure && (
        <div className="card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-1">LangGraph Investigation Graph</div>
          <p className="text-[10px] text-lo mb-5">{graphStructure.description}</p>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {graphStructure.nodes.map((node: any, i: number) => {
                const color = NODE_COLORS[node.id] || "#a8e63d";
                return (
                  <div key={node.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="px-4 py-3 rounded-xl border text-center w-36"
                        style={{ background: `${color}12`, borderColor: `${color}35` }}>
                        <div className="text-[11px] font-bold mb-1" style={{ color }}>{node.label}</div>
                        <div className="text-[9px] text-lo leading-relaxed">{node.description}</div>
                      </div>
                    </div>
                    {i < graphStructure.nodes.length - 1 && (
                      <div className="flex items-center px-2">
                        <div className="h-px w-6 bg-border" />
                        <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent" style={{ borderLeftColor: "rgba(255,255,255,0.15)" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {graphStructure.edges.filter((e: any) => e.condition).map((edge: any, i: number) => (
              <div key={i} className="text-[10px] bg-raised rounded-xl p-3 border border-border">
                <div className="text-lo mb-1">{edge.from} → {edge.to}</div>
                <div className="text-mid">Condition: {edge.condition}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phoenix traces */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Phoenix Traces</div>
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <span className="badge badge-healthy">Live</span>
            ) : (
              <span className="badge badge-neutral">Start Phoenix to view traces</span>
            )}
            <button onClick={load} className="text-[10px] text-lo hover:text-hi transition-colors">Refresh</button>
          </div>
        </div>
        {traces.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-[12px] text-lo mb-3">
              {status?.connected ? "No traces yet — run example_agent.py to generate spans" : "Phoenix offline — start with docker compose up -d phoenix"}
            </div>
            <code className="text-[10px] font-mono bg-raised px-3 py-2 rounded-xl text-mid">
              python backend/example_agent.py
            </code>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {traces.slice(0, 20).map((trace: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="px-5 py-3 hover:bg-surface transition-colors text-[11px]">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-lime text-[10px] w-24 shrink-0 truncate">
                    {trace.trace_id?.slice(0, 12) || `trace-${i}`}
                  </div>
                  <div className="flex-1 text-hi truncate">{trace.name || trace.span_kind || "LLM span"}</div>
                  <div className="text-lo text-[10px] shrink-0">
                    {trace.latency_ms ? `${trace.latency_ms.toFixed(0)}ms` : "—"}
                  </div>
                  <div className="text-lo text-[10px] shrink-0">
                    {trace.start_time ? timeAgo(trace.start_time) : "recent"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Example agent quickstart */}
      <div className="card p-5">
        <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Quickstart — Run Example Agent</div>
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          {[
            { step: "1", title: "Set API key", code: "export GOOGLE_API_KEY=your_key" },
            { step: "2", title: "Start Phoenix", code: "docker compose up -d phoenix" },
            { step: "3", title: "Run agent",    code: "python backend/example_agent.py" },
          ].map(s => (
            <div key={s.step} className="bg-raised rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-lime/10 text-lime text-[10px] font-black flex items-center justify-center">{s.step}</span>
                <span className="text-hi font-medium">{s.title}</span>
              </div>
              <code className="text-lime font-mono text-[9px]">{s.code}</code>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-lo">
          After running, Phoenix at <a href="http://localhost:6006" target="_blank" className="text-lime hover:underline">localhost:6006</a> will show real LLM spans, and AgentGuard live feed will update automatically.
        </div>
      </div>
    </div>
  );
}
