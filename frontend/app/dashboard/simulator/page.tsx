"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agentsApi, simulatorApi, simulatorApiV2 } from "@/lib/api";
import { cn, getTrustColor, formatMs } from "@/lib/utils";

interface SimAgent { id: string; name: string; agent_type: string; trust_score: number; status: string; accuracy: number; drift_score: number; hallucination_rate: number; avg_latency_ms: number; }
interface LiveMetrics { trustScore: number; driftScore: number; hallucinationRate: number; latencyMs: number; }
interface InvStep { title: string; detail: string; state: "pending" | "running" | "done"; }

const SCENARIOS = [
  { id: "prompt_drift",        name: "Prompt Drift",        icon: "⚡", severity: "high",     color: "#f97316" },
  { id: "retrieval_drift",     name: "Retrieval Drift",     icon: "🔍", severity: "critical", color: "#ef4444" },
  { id: "hallucination_surge", name: "Hallucination Surge", icon: "💭", severity: "critical", color: "#ef4444" },
  { id: "latency_spike",       name: "Latency Spike",       icon: "⏱",  severity: "high",     color: "#f97316" },
  { id: "safety_violation",    name: "Safety Violation",    icon: "🛡",  severity: "critical", color: "#ef4444" },
  { id: "cost_explosion",      name: "Cost Explosion",      icon: "💸", severity: "high",     color: "#f97316" },
  { id: "tool_failure",        name: "Tool Failure",        icon: "🔧", severity: "high",     color: "#f97316" },
  { id: "kb_staleness",        name: "KB Staleness",        icon: "📚", severity: "medium",   color: "#eab308" },
];

const SCENARIO_FALLBACK: Record<string, { rootCause: string; impact: string; fixes: string[]; timeline: string[] }> = {
  prompt_drift: {
    rootCause: "System prompt token budget exceeded — response format instructions truncated at 89% of max context window, causing inconsistent output structure across 67% of queries.",
    impact: "Instruction-following accuracy dropped from 94% to 61%. Approximately 340 user interactions returned malformed responses.",
    fixes: ["Compress system prompt — remove redundant instructions (est. 28% reduction)", "Split long prompts into layered instruction sets", "Add format validation with automatic retry on schema mismatch", "Implement prompt length monitoring with 80% threshold alert"],
    timeline: ["Agent operating normally at 94% accuracy", "Token budget exceeded during high-volume query burst", "Instruction truncation detected in 12% of responses", "Format failures cascaded to 67% of queries", "AgentGuard drift score crossed 0.18 threshold", "LangGraph investigation triggered autonomously", "Root cause confirmed: prompt token overflow", "Fix recommendations generated and ranked"],
  },
  retrieval_drift: {
    rootCause: "Vector embeddings are 23 model versions behind current encoder. Semantic similarity scores degraded by 41% — queries returning stale, semantically mismatched documents.",
    impact: "Retrieval precision fell from 0.89 to 0.52. An estimated 28% of responses contain information outdated by 6+ months.",
    fixes: ["Re-index entire knowledge base with current embedding model (est. 4h)", "Implement automated staleness detection at 14-day intervals", "Add retrieval confidence threshold — fallback when similarity < 0.65", "Version-pin embeddings to auto-upgrade with model updates"],
    timeline: ["Retrieval relevance baseline: 0.89", "Embedding model updated upstream without re-indexing", "Similarity scores declined 0.89 → 0.74", "Precision recall gap exceeded 0.15 threshold", "Hallucination rate correlated with retrieval failures", "LangGraph investigation triggered", "23-version embedding lag confirmed as root cause", "Urgent re-indexing queued with priority flag"],
  },
  hallucination_surge: {
    rootCause: "Confidence calibration failure — model producing high-certainty outputs (>0.85) for responses with no supporting evidence following retrieval degradation.",
    impact: "Hallucination rate surged from 1.8% to 14.2% over 3 hours. 6 external-facing responses contained fabricated data.",
    fixes: ["Enable strict citation enforcement — all factual claims must reference source documents", "Lower confidence threshold to 0.60 for unsupported assertions", "Add output validation layer with knowledge source cross-check", "Implement human review queue for high-risk categories"],
    timeline: ["Baseline hallucination rate: 1.8%", "Retrieval quality degradation detected upstream", "Model began generating plausible but ungrounded content", "Rate climbed to 7.1% — approaching alert threshold", "Rate exceeded 10% — critical alert triggered", "LangGraph Gemini RCA initiated", "Confidence calibration failure confirmed", "Citation enforcement fix queued"],
  },
  latency_spike: {
    rootCause: "LLM provider rate limiting triggered at 89 req/min. Missing request timeout configuration caused unbounded queue growth. P99 latency reached 11.2 seconds.",
    impact: "35% of users experienced >5 second response times for 2.5 hours. Session completion rate dropped 23%.",
    fixes: ["Implement 5-second hard timeout with graceful degradation", "Add circuit breaker at 85% of rate limit capacity", "Deploy semantic response cache — est. 40% hit rate", "Configure secondary provider failover <200ms switchover"],
    timeline: ["P99 latency baseline: 820ms", "Traffic volume increased 2.4x during peak window", "Provider rate limiting engaged at 89 req/min", "Queue grew unbounded — no timeout configured", "P99 reached 8s — SLA breach triggered", "AgentGuard latency investigation initiated", "Rate limit + missing timeout confirmed", "Circuit breaker fix recommended"],
  },
  safety_violation: {
    rootCause: "Adversarial prompt injection bypass — encoding variant circumvented content safety filter. 8 successful jailbreaks confirmed in 2-hour window.",
    impact: "Safety filter bypassed in 8 confirmed interactions. Outputs violated content policy in 3 cases.",
    fixes: ["Deploy input sanitization layer immediately", "Upgrade safety filter to v3.4 with adversarial robustness", "Add redundant output check independent of system prompt", "Conduct full audit of last 6 hours of responses"],
    timeline: ["Safety filter active — normal operations", "First injection attempt detected and blocked", "Adversarial encoding variant discovered", "Safety bypass confirmed — 8 interactions", "Policy violations generated in 3 cases", "AgentGuard emergency alert triggered", "Prompt injection root cause confirmed", "Immediate sanitization patch deployed"],
  },
  cost_explosion: {
    rootCause: "Unbounded context growth in multi-turn conversation handler. Conversations exceeding 50 turns included full history every request — token cost multiplied 18x.",
    impact: "Daily cost increased from $240 to $4,320 over 6 hours. Projected monthly impact: +$120,000.",
    fixes: ["Hard context window truncation at 8,000 tokens", "Per-conversation cost cap with context compression", "Conversation length monitoring — alert at 20 turns", "Context summarization for long-running threads"],
    timeline: ["Baseline daily cost: $240", "Multi-turn feature deployed without context limit", "Long conversations accumulating full history", "Cost multiplier observed at >50 turn threads", "Daily projection exceeded $2,000", "AgentGuard cost anomaly triggered", "Unbounded context growth confirmed", "Truncation + cost cap fix generated"],
  },
  tool_failure: {
    rootCause: "External CRM API returning 429 errors after vendor plan downgrade. No fallback behavior — failures propagating silently.",
    impact: "22% of customer support queries missing account context. Escalation rate +31%.",
    fixes: ["Exponential backoff with jitter for all tool calls", "Explicit fallback responses when tool unavailable", "Tool failure alerting at >2% error rate", "Vendor plan upgrade or local data cache"],
    timeline: ["CRM API performing normally", "Vendor plan downgrade applied silently", "429 rate limit errors began accumulating", "Tool calls failing — no user-visible errors", "Generic responses replacing personalized answers", "Escalation rate up 31% over 2 hours", "AgentGuard tool failure investigation triggered", "Vendor plan downgrade root cause confirmed"],
  },
  kb_staleness: {
    rootCause: "Knowledge base stale for 22 days. Scheduled re-indexing job failed silently on day 8 — storage quota exceeded with no alerting configured.",
    impact: "31% of queries returning outdated information. Support escalation rate +18%.",
    fixes: ["Immediately trigger full knowledge base re-index", "Storage quota alerts at 80% threshold", "Knowledge currency scoring in agent responses", "Automated staleness check — degrade flag at 14 days"],
    timeline: ["Knowledge base last updated 22 days ago", "Re-indexing job failed silently on day 8", "Storage quota exceeded — no alert fired", "Agents returning outdated policy information", "User complaint volume up 18%", "AgentGuard knowledge currency check triggered", "Silent job failure root cause identified", "Storage quota alert + re-index fix generated"],
  },
};

const TARGET_DELTAS: Record<string, { trust: number; drift: number; halluc: number; latency: number }> = {
  prompt_drift:        { trust: -0.19, drift: +0.35, halluc: +4.2,  latency: +1.3  },
  retrieval_drift:     { trust: -0.30, drift: +0.48, halluc: +12.4, latency: +2.1  },
  hallucination_surge: { trust: -0.35, drift: +0.28, halluc: +14.2, latency: +1.1  },
  latency_spike:       { trust: -0.10, drift: +0.14, halluc: +2.1,  latency: +13.7 },
  safety_violation:    { trust: -0.42, drift: +0.44, halluc: +18.6, latency: +1.2  },
  cost_explosion:      { trust: -0.12, drift: +0.12, halluc: +2.8,  latency: +10.8 },
  tool_failure:        { trust: -0.24, drift: +0.17, halluc: +4.2,  latency: +2.9  },
  kb_staleness:        { trust: -0.16, drift: +0.22, halluc: +8.9,  latency: +1.2  },
};

const INV_STEPS_LABELS = [
  { title: "Anomaly detection",      detail: (sc: string) => `${sc.replace(/_/g," ")} signature detected — threshold exceeded` },
  { title: "Evidence collection",    detail: () => "Pulling 48h metrics, drift events, and hallucinations from PostgreSQL" },
  { title: "Arize Phoenix traces",   detail: () => "Fetching LLM spans from Phoenix OTEL endpoint" },
  { title: "Gemini root cause RCA",  detail: () => "Gemini 2.0 Flash analyzing evidence with structured JSON output" },
  { title: "Incident creation",      detail: () => "Autonomously persisting incident record with timeline to PostgreSQL" },
  { title: "Operator notification",  detail: () => "Slack notification dispatched (if SLACK_WEBHOOK_URL configured)" },
];
const INV_STEP_DELAYS = [0, 1500, 3000, 4500, 7000, 9000];

const SEV_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308" };
const getMetricColor = (key: string, v: number) => {
  if (key === "trust")   return v >= 85 ? "#a8e63d" : v >= 70 ? "#f97316" : "#ef4444";
  if (key === "drift")   return v < 8 ? "#a8e63d" : v < 20 ? "#f97316" : "#ef4444";
  if (key === "halluc")  return v < 2 ? "#a8e63d" : v < 5 ? "#f97316" : "#ef4444";
  if (key === "latency") return v < 1000 ? "#a8e63d" : v < 4000 ? "#f97316" : "#ef4444";
  return "#a8e63d";
};
const getBarPct = (key: string, v: number) => {
  if (key === "trust")   return Math.max(0, Math.min(100, v));
  if (key === "drift")   return Math.min(100, v * 3);
  if (key === "halluc")  return Math.min(100, v * 5);
  if (key === "latency") return Math.min(100, v / 120);
  return 50;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;

function MetricCard({ label, value, unit, barKey, delta }: { label: string; value: number; unit: string; barKey: string; delta: number; }) {
  const color = getMetricColor(barKey, value);
  const pct   = getBarPct(barKey, value);
  const isBad = (barKey === "trust" && delta < 0) || (barKey !== "trust" && delta > 0);
  const dColor = delta === 0 ? "var(--color-text-secondary)" : isBad ? "#ef4444" : "#a8e63d";
  const sign   = delta > 0 ? "+" : "";
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-widest text-lo mb-2">{label}</div>
      <motion.div className="text-3xl font-black" style={{ color }} animate={{ color }} transition={{ duration: 0.4 }}>
        {unit === "ms" ? value.toFixed(0) : value.toFixed(1)}{unit}
      </motion.div>
      <div className="text-[10px] mt-1 font-mono" style={{ color: dColor }}>
        {delta !== 0 ? `${sign}${Math.abs(delta).toFixed(1)}${unit} from baseline` : "—"}
      </div>
      <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "var(--color-border-tertiary)" }}>
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const [agents,       setAgents]       = useState<SimAgent[]>([]);
  const [selAgent,     setSelAgent]     = useState<SimAgent | null>(null);
  const [selScenario,  setSelScenario]  = useState<typeof SCENARIOS[0] | null>(null);
  const [phase,        setPhase]        = useState<"idle" | "injecting" | "detecting" | "investigating" | "done">("idle");
  const [liveMetrics,  setLiveMetrics]  = useState<LiveMetrics>({ trustScore: 90, driftScore: 0, hallucinationRate: 1.8, latencyMs: 820 });
  const [baseMetrics,  setBaseMetrics]  = useState<LiveMetrics>({ trustScore: 90, driftScore: 0, hallucinationRate: 1.8, latencyMs: 820 });
  const [invSteps,     setInvSteps]     = useState<InvStep[]>([]);
  const [invProgress,  setInvProgress]  = useState(0);
  const [showReport,   setShowReport]   = useState(false);
  const [showAlert,    setShowAlert]    = useState(false);
  const [geminiResult, setGeminiResult] = useState<any>(null);
  const [timelineShow, setTimelineShow] = useState(0);
  const [fixesShow,    setFixesShow]    = useState(0);
  const [backendAvail, setBackendAvail] = useState<boolean | null>(null);
  const [geminiLive,   setGeminiLive]   = useState<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    agentsApi.list({ limit: "20" })
      .then(r => {
        setBackendAvail(true);
        const data: SimAgent[] = r.data || [];
        setAgents(data);
        if (data.length) {
          const a = data[0];
          setSelAgent(a);
          const m = { trustScore: a.trust_score, driftScore: a.drift_score*100, hallucinationRate: a.hallucination_rate*100, latencyMs: a.avg_latency_ms };
          setLiveMetrics(m); setBaseMetrics(m);
        }
      })
      .catch(() => {
        setBackendAvail(false);
        const fallback: SimAgent[] = [
          { id:"d1", name:"Apex Support Agent",   agent_type:"customer_support", trust_score:96.2, status:"healthy",  accuracy:0.97, drift_score:0.03, hallucination_rate:0.008, avg_latency_ms:482  },
          { id:"d2", name:"CodePilot Enterprise", agent_type:"coding",           trust_score:79.3, status:"critical", accuracy:0.80, drift_score:0.28, hallucination_rate:0.082, avg_latency_ms:1820 },
          { id:"d3", name:"FinAdvisor AI",        agent_type:"financial",        trust_score:93.7, status:"healthy",  accuracy:0.94, drift_score:0.05, hallucination_rate:0.012, avg_latency_ms:890  },
          { id:"d4", name:"HR Assistant v2",      agent_type:"hr",               trust_score:84.1, status:"warning",  accuracy:0.85, drift_score:0.18, hallucination_rate:0.048, avg_latency_ms:520  },
          { id:"d5", name:"Marketing Copilot",    agent_type:"custom",           trust_score:76.8, status:"critical", accuracy:0.77, drift_score:0.32, hallucination_rate:0.091, avg_latency_ms:740  },
          { id:"d6", name:"Legal Assistant",      agent_type:"knowledge",        trust_score:94.9, status:"healthy",  accuracy:0.95, drift_score:0.04, hallucination_rate:0.009, avg_latency_ms:1100 },
        ];
        setAgents(fallback);
        const a = fallback[0];
        setSelAgent(a);
        const m = { trustScore:a.trust_score, driftScore:a.drift_score*100, hallucinationRate:a.hallucination_rate*100, latencyMs:a.avg_latency_ms };
        setLiveMetrics(m); setBaseMetrics(m);
      });
    return clearAll;
  }, []);

  const handleAgentSelect = (a: SimAgent) => {
    if (phase !== "idle") return;
    setSelAgent(a);
    const m = { trustScore:a.trust_score, driftScore:a.drift_score*100, hallucinationRate:a.hallucination_rate*100, latencyMs:a.avg_latency_ms };
    setLiveMetrics(m); setBaseMetrics(m);
  };

  const animateToTarget = useCallback((base: LiveMetrics, target: LiveMetrics) => {
    let step = 0; const total = 42;
    const tick = () => {
      step++;
      const t = ease(step/total);
      setLiveMetrics({
        trustScore:        Math.round(lerp(base.trustScore,        target.trustScore,        t)*10)/10,
        driftScore:        Math.round(lerp(base.driftScore,        target.driftScore,        t)*10)/10,
        hallucinationRate: Math.round(lerp(base.hallucinationRate, target.hallucinationRate, t)*10)/10,
        latencyMs:         Math.round(lerp(base.latencyMs,         target.latencyMs,         t)),
      });
      if (step < total) addTimer(tick, 80);
      else setLiveMetrics(target);
    };
    addTimer(tick, 80);
  }, []);

  const handleInject = useCallback(async () => {
    if (!selAgent || !selScenario || phase !== "idle") return;
    clearAll();
    setPhase("injecting"); setShowAlert(false); setShowReport(false);
    setInvSteps([]); setInvProgress(0); setTimelineShow(0); setFixesShow(0); setGeminiResult(null);

    const sc = selScenario;
    const base = { ...baseMetrics };
    const d = TARGET_DELTAS[sc.id] || { trust:-0.15, drift:+0.2, halluc:+3, latency:+1.5 };
    const target: LiveMetrics = {
      trustScore:        Math.max(25, base.trustScore*(1+d.trust)),
      driftScore:        Math.min(100, base.driftScore+d.drift*100),
      hallucinationRate: Math.min(30, base.hallucinationRate+d.halluc),
      latencyMs:         Math.min(15000, base.latencyMs*(sc.id==="latency_spike"?d.latency:1+(d.latency-1)*0.6)),
    };

    // Animate metrics visually
    animateToTarget(base, target);

    // Build investigation steps
    const steps: InvStep[] = INV_STEPS_LABELS.map(s => ({
      title: s.title, detail: s.detail(sc.id), state: "pending" as const,
    }));
    setInvSteps(steps);

    // Alert at 1.8s
    addTimer(() => { setShowAlert(true); setPhase("detecting"); }, 1800);

    // Start investigation animation at 3s
    addTimer(() => { setPhase("investigating"); }, 3000);

    INV_STEP_DELAYS.forEach((delay, i) => {
      addTimer(() => {
        setInvSteps(prev => prev.map((s, j) => j===i ? {...s, state:"running"} : j<i ? {...s, state:"done"} : s));
        setInvProgress(Math.round((i+1)/steps.length*100));
      }, 3000+delay);
    });

    // Call backend — inject-and-investigate for real Gemini RCA
    const callBackend = async () => {
      if (backendAvail && !selAgent.id.startsWith("d")) {
        try {
          const res = await simulatorApiV2.injectAndInvestigate(selAgent.id, sc.id);
          const data = res.data;
          setGeminiLive(true);
          setGeminiResult(data.langgraph_result || null);
          return data;
        } catch { /* fallback */ }
      }
      setGeminiLive(false);
      return null;
    };

    // Wait for both animation and API call
    const [, apiData] = await Promise.all([
      new Promise<void>(resolve => addTimer(() => resolve(), 3000 + INV_STEP_DELAYS[INV_STEP_DELAYS.length-1] + 1200)),
      callBackend(),
    ]);

    // Final step — done
    setInvSteps(prev => prev.map(s => ({...s, state:"done"})));
    setInvProgress(100);
    setPhase("done");
    setShowReport(true);

    // Cascade timeline and fixes
    const fallback = SCENARIO_FALLBACK[sc.id];
    const timelineLen = apiData?.langgraph_result?.incident_id ? 8 : fallback.timeline.length;
    const fixesLen    = apiData?.langgraph_result?.recommended_actions?.length || fallback.fixes.length;
    for (let i = 0; i < timelineLen; i++) addTimer(() => setTimelineShow(i+1), 200+i*130);
    for (let i = 0; i < fixesLen; i++)    addTimer(() => setFixesShow(i+1),    350+i*220);
  }, [selAgent, selScenario, phase, baseMetrics, backendAvail, animateToTarget]);

  const handleRecover = useCallback(async () => {
    clearAll();
    if (backendAvail && selAgent && !selAgent.id.startsWith("d")) {
      try { await simulatorApi.recover(selAgent.id); } catch {}
    }
    setPhase("idle"); setShowAlert(false); setShowReport(false);
    setInvSteps([]); setInvProgress(0); setTimelineShow(0); setFixesShow(0); setGeminiResult(null);
    if (selAgent) {
      const m = { trustScore:selAgent.trust_score, driftScore:selAgent.drift_score*100, hallucinationRate:selAgent.hallucination_rate*100, latencyMs:selAgent.avg_latency_ms };
      setLiveMetrics(m); setBaseMetrics(m);
    }
  }, [selAgent, backendAvail]);

  // Determine what to display in the report
  const sc = selScenario;
  const fallback = sc ? SCENARIO_FALLBACK[sc.id] : null;
  const rootCause   = geminiResult?.root_cause   || fallback?.rootCause  || "";
  const impact      = geminiResult?.impact        || fallback?.impact     || "";
  const fixes       = geminiResult?.recommended_actions || fallback?.fixes || [];
  const timeline    = fallback?.timeline || [];
  const confidence  = geminiResult?.confidence_score ? Math.round(geminiResult.confidence_score*100) : sc?.severity==="critical" ? 94 : 88;

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Drift Injection Simulator</h1>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full"
              style={{ background:"rgba(168,230,61,0.12)", color:"#a8e63d", border:"1px solid rgba(168,230,61,0.25)" }}>
              JUDGE DEMO MODE
            </span>
            {backendAvail===true  && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background:"rgba(168,230,61,0.1)", color:"#a8e63d", border:"1px solid rgba(168,230,61,0.2)" }}>Live API</span>}
            {backendAvail===false && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background:"rgba(249,115,22,0.1)", color:"#f97316", border:"1px solid rgba(249,115,22,0.2)" }}>Demo mode</span>}
            {geminiLive===true    && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background:"rgba(168,230,61,0.1)", color:"#a8e63d", border:"1px solid rgba(168,230,61,0.2)" }}>Gemini Live</span>}
          </div>
          <p className="text-[11px] text-lo">Break an AI agent — watch AgentGuard + LangGraph detect, investigate with Gemini, and explain in real time</p>
        </div>
        {phase!=="idle" && <button onClick={handleRecover} className="filter-pill text-[11px]">Recover + Reset</button>}
      </div>

      {/* Step 1 */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-lo mb-2"><span style={{color:"#a8e63d"}}>1</span> — Select agent to target</div>
        <div className="flex gap-2 flex-wrap">
          {agents.slice(0,8).map(a => (
            <button key={a.id} onClick={() => handleAgentSelect(a)} disabled={phase!=="idle"}
              className="text-left transition-all disabled:cursor-not-allowed"
              style={{ background:selAgent?.id===a.id?"rgba(168,230,61,0.08)":"var(--color-background-secondary)", border:`${selAgent?.id===a.id?"1.5":"0.5"}px solid ${selAgent?.id===a.id?"rgba(168,230,61,0.5)":"var(--color-border-tertiary)"}`, borderRadius:12, padding:"8px 14px" }}>
              <div className="text-[11px] font-semibold text-hi">{a.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-[10px] font-mono font-black", getTrustColor(a.trust_score))}>{a.trust_score.toFixed(0)}</span>
                <span className="text-[10px] text-lo capitalize">{a.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-lo mb-2"><span style={{color:"#a8e63d"}}>2</span> — Choose failure scenario</div>
        <div className="grid grid-cols-4 gap-2">
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => phase==="idle" && setSelScenario(s)} disabled={phase!=="idle"}
              className="card text-left p-4 transition-all disabled:cursor-not-allowed hover:border-ring"
              style={selScenario?.id===s.id?{borderColor:s.color,borderWidth:"1.5px"}:{}}>
              <div className="text-xl mb-2">{s.icon}</div>
              <div className="text-[11px] font-bold text-hi mb-1.5">{s.name}</div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                style={{ background:`${SEV_COLORS[s.severity]}18`, color:SEV_COLORS[s.severity] }}>
                {s.severity}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Inject button */}
      <motion.button onClick={handleInject} disabled={!selAgent||!selScenario||phase!=="idle"} whileTap={{scale:0.99}}
        className="w-full py-4 rounded-2xl font-black text-[14px] tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: phase==="done"?"rgba(168,230,61,0.1)":phase!=="idle"?"rgba(239,68,68,0.08)":"#1a1a1a",
          color:      phase==="done"?"#a8e63d":phase!=="idle"?"#ef4444":"#a8e63d",
          border:     `1.5px solid ${phase==="done"?"rgba(168,230,61,0.4)":phase!=="idle"?"rgba(239,68,68,0.4)":"rgba(168,230,61,0.35)"}`,
        }}>
        {phase==="idle"          && (selScenario?`⚡  Break Agent — Inject ${selScenario.name} + Run LangGraph Investigation`:"⚡  Select agent + scenario to begin")}
        {phase==="injecting"     && `⚡  Injecting ${selScenario?.name}...`}
        {phase==="detecting"     && "Anomaly detected — LangGraph investigation triggered autonomously"}
        {phase==="investigating" && "LangGraph running: gather → Phoenix traces → Gemini RCA → create incident →"}
        {phase==="done"          && "Investigation complete — Gemini root cause report below"}
      </motion.button>

      {/* Alert banner */}
      <AnimatePresence>
        {showAlert && sc && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="flex items-center gap-3 rounded-2xl px-5 py-3 text-[12px]"
            style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.28)"}}>
            <motion.div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:"#ef4444"}}
              animate={{opacity:[1,0.3,1]}} transition={{duration:0.9,repeat:Infinity}} />
            <span className="text-hi font-semibold">{sc.name} detected</span>
            <span className="text-mid">on {selAgent?.name}</span>
            <span className="text-lo mx-1">—</span>
            <span className="text-lo">LangGraph autonomous investigation triggered</span>
            {geminiResult?.incident_id && <span className="ml-auto text-[10px]" style={{color:"#a8e63d"}}>Incident created in DB</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live metrics */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-lo mb-2">Live metrics</div>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Trust Score"        value={liveMetrics.trustScore}        unit=""   barKey="trust"   delta={Math.round((liveMetrics.trustScore-baseMetrics.trustScore)*10)/10} />
          <MetricCard label="Drift Score"        value={liveMetrics.driftScore}        unit="%"  barKey="drift"   delta={Math.round((liveMetrics.driftScore-baseMetrics.driftScore)*10)/10} />
          <MetricCard label="Hallucination Rate" value={liveMetrics.hallucinationRate} unit="%"  barKey="halluc"  delta={Math.round((liveMetrics.hallucinationRate-baseMetrics.hallucinationRate)*10)/10} />
          <MetricCard label="Avg Latency"        value={liveMetrics.latencyMs}         unit="ms" barKey="latency" delta={Math.round(liveMetrics.latencyMs-baseMetrics.latencyMs)} />
        </div>
      </div>

      {/* Investigation panel */}
      <AnimatePresence>
        {invSteps.length>0 && (
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-[11px] font-bold text-hi uppercase tracking-widest">LangGraph autonomous investigation</div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-40 rounded-full overflow-hidden" style={{background:"var(--color-border-tertiary)"}}>
                  <motion.div className="h-full rounded-full" style={{background:"#a8e63d"}} animate={{width:`${invProgress}%`}} transition={{duration:0.5}} />
                </div>
                <span className="text-[11px] text-lo font-mono min-w-[32px]">{invProgress}%</span>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {invSteps.map((step, i) => (
                <motion.div key={i} initial={{opacity:0,x:-6}} animate={{opacity:step.state==="pending"?0.35:1,x:0}} transition={{delay:i*0.04}}
                  className="flex items-start gap-3">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5 font-bold border",
                    step.state==="done"?"text-lime":step.state==="running"?"text-orange":"text-lo")}
                    style={{
                      background: step.state==="done"?"rgba(168,230,61,0.12)":step.state==="running"?"rgba(249,115,22,0.12)":"var(--color-background-secondary)",
                      borderColor:step.state==="done"?"rgba(168,230,61,0.3)":step.state==="running"?"rgba(249,115,22,0.3)":"var(--color-border-tertiary)",
                    }}>
                    {step.state==="done"?"✓":step.state==="running"
                      ? <motion.span animate={{opacity:[1,0.3,1]}} transition={{duration:0.7,repeat:Infinity}}>●</motion.span>
                      : "○"}
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-hi">{step.title}</div>
                    {step.state!=="pending" && <div className="text-[10px] text-lo mt-0.5 leading-relaxed">{step.detail}</div>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report */}
      <AnimatePresence>
        {showReport && sc && (
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="space-y-3">
            {/* Summary */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Incident report</div>
                  {geminiLive && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{background:"rgba(168,230,61,0.1)",color:"#a8e63d",border:"1px solid rgba(168,230,61,0.2)"}}>Gemini generated</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize" style={{background:`${SEV_COLORS[sc.severity]}18`,color:SEV_COLORS[sc.severity]}}>{sc.severity}</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background:"rgba(168,230,61,0.1)",color:"#a8e63d",border:"1px solid rgba(168,230,61,0.2)"}}>Confidence: {confidence}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["Failure Type", sc.name, ""], ["Severity", sc.severity, `capitalize`]].map(([l,v,cls]) => (
                  <div key={l} className="bg-raised rounded-xl p-3 border border-border">
                    <div className="text-[10px] text-lo uppercase tracking-wider mb-1">{l}</div>
                    <div className={cn("text-[12px] text-hi font-medium", cls)} style={l==="Severity"?{color:SEV_COLORS[sc.severity]}:{}}>{v}</div>
                  </div>
                ))}
                <div className="col-span-2 bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Root Cause{geminiLive?" (Gemini Generated)":""}</div>
                  <div className="text-[12px] text-hi leading-relaxed">{rootCause}</div>
                </div>
                <div className="col-span-2 bg-raised rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-lo uppercase tracking-wider mb-1">Impact Assessment</div>
                  <div className="text-[12px] text-hi leading-relaxed">{impact}</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card p-5">
              <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Incident Timeline</div>
              <div className="relative space-y-0">
                <div className="absolute left-[42px] top-2 bottom-2 w-px border-l border-dashed border-border" />
                {timeline.slice(0,timelineShow).map((ev,i) => {
                  const pct = i/Math.max(1,timeline.length-1);
                  const dotC = i>=timeline.length-3?"#a8e63d":pct>0.5?"#f97316":"#ef4444";
                  const bgC  = i>=timeline.length-3?"rgba(168,230,61,0.06)":pct>0.5?"rgba(249,115,22,0.06)":"rgba(239,68,68,0.06)";
                  const bdrC = i>=timeline.length-3?"rgba(168,230,61,0.18)":pct>0.5?"rgba(249,115,22,0.18)":"rgba(239,68,68,0.18)";
                  const now  = new Date();
                  const ts   = new Date(now.getTime()-(timeline.length-1-i)*3*60000);
                  const t    = ts.getHours().toString().padStart(2,"0")+":"+ts.getMinutes().toString().padStart(2,"0");
                  return (
                    <motion.div key={i} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} className="flex items-start gap-3 pb-3 last:pb-0 relative">
                      <div className="w-10 shrink-0 text-right pt-1.5"><span className="text-[10px] text-lo font-mono">{t}</span></div>
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0 relative z-10" style={{backgroundColor:dotC}} />
                      <div className="flex-1 text-[11px] px-3 py-1.5 rounded-xl border leading-relaxed"
                        style={{background:bgC,borderColor:bdrC,color:dotC}}>{ev}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Fixes */}
            <div className="card p-5">
              <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-3">Recommended Actions{geminiLive?" (Gemini Generated)":""}</div>
              <div className="space-y-2">
                {fixes.slice(0,fixesShow).map((fix: any, i: number) => (
                  <motion.div key={i} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}}
                    className="flex items-start gap-3 p-3 rounded-xl border"
                    style={{background:"rgba(168,230,61,0.04)",borderColor:"rgba(168,230,61,0.18)"}}>
                    <span className="text-[10px] font-bold text-lime shrink-0 mt-0.5 font-mono">{String(i+1).padStart(2,"0")}</span>
                    <span className="text-[11px] text-hi leading-relaxed flex-1">{fix}</span>
                    <button className="text-[10px] text-lime hover:text-lime/80 shrink-0 font-medium">Apply</button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Real API comparison */}
            {geminiResult && (
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-widest text-lo mb-3">LangGraph Investigation Stats</div>
                <div className="grid grid-cols-4 gap-3 text-[11px]">
                  {[
                    { label:"Incident Created", value:geminiResult.incident_id?"Yes":"No",     color:geminiResult.incident_id?"text-lime":"text-lo" },
                    { label:"Metrics Analyzed",  value:geminiResult.metrics_analyzed||0,        color:"text-hi" },
                    { label:"Phoenix Traces",    value:geminiResult.phoenix_traces||0,          color:"text-hi" },
                    { label:"Slack Notified",    value:geminiResult.notification_sent?"Yes":"No",color:geminiResult.notification_sent?"text-lime":"text-lo" },
                  ].map(s => (
                    <div key={s.label} className="bg-raised rounded-xl p-3 border border-border">
                      <div className="text-[10px] text-lo uppercase tracking-wider mb-1">{s.label}</div>
                      <div className={cn("text-[16px] font-black", s.color)}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
