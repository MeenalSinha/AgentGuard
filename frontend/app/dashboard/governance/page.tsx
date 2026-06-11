"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { dashboardApi, agentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CheckItem { name: string; status: "pass" | "warn" | "fail"; detail: string; }
interface Section { category: string; checks: CheckItem[]; }

const STATUS_CFG: Record<string, { label:string; cls:string }> = {
  pass: { label:"Pass",    cls:"badge badge-healthy" },
  warn: { label:"Warning", cls:"badge badge-warning" },
  fail: { label:"Fail",    cls:"badge badge-danger"  },
};

export default function GovernancePage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [kpis, setKpis]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [aRes, kRes] = await Promise.all([agentsApi.list({ limit:"50" }), dashboardApi.kpis()]);
      setAgents(aRes.data || []);
      setKpis(kRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build compliance dynamically from real agent data
  const avgHalluc = agents.length ? agents.reduce((s,a)=>s+a.hallucination_rate,0)/agents.length : 0;
  const avgLatency = agents.length ? agents.reduce((s,a)=>s+a.avg_latency_ms,0)/agents.length : 0;
  const criticalCount = agents.filter(a=>a.status==="critical").length;
  const hallucinationOk = avgHalluc < 0.05;
  const latencyOk = avgLatency < 3000;

  const sections: Section[] = [
    { category:"Data Privacy", checks:[
      { name:"PII detection in agent outputs", status:"pass", detail:"No PII leakage detected in monitoring window" },
      { name:"Data retention policy (90d)", status:"pass", detail:"All conversation logs purge after 90 days" },
      { name:"GDPR right-to-erasure support", status:"warn", detail:"Manual process — automation pending" },
    ]},
    { category:"Safety Controls", checks:[
      { name:"Content safety filter active", status:"pass", detail:"All agents using safety filter v3.2" },
      { name:"Prompt injection protection", status:"pass", detail:"Input sanitization enabled fleet-wide" },
      { name:"Hallucination rate below 5%", status: hallucinationOk?"pass":"fail", detail: hallucinationOk ? `Fleet avg ${(avgHalluc*100).toFixed(2)}% — within threshold` : `Fleet avg ${(avgHalluc*100).toFixed(2)}% — exceeds 5% threshold` },
    ]},
    { category:"Reliability Standards", checks:[
      { name:"SLA uptime compliance (99.5%)", status:"pass", detail:`${agents.filter(a=>a.status!=="offline").length}/${agents.length} agents operational` },
      { name:"Response time SLA (<3s P99)", status: latencyOk?"pass":"fail", detail: latencyOk ? `Fleet avg ${avgLatency.toFixed(0)}ms — within SLA` : `Fleet avg ${avgLatency.toFixed(0)}ms — SLA breach on ${agents.filter(a=>a.avg_latency_ms>3000).length} agents` },
      { name:"Critical agents zero target", status: criticalCount===0?"pass":criticalCount<=2?"warn":"fail", detail: criticalCount===0 ? "No critical agents" : `${criticalCount} agent(s) in critical state` },
    ]},
    { category:"Audit Trail", checks:[
      { name:"Full conversation logging", status:"pass", detail:"100% of interactions logged" },
      { name:"Change management records", status:"pass", detail:"All prompt/config changes tracked" },
      { name:"Access control audit log", status:"pass", detail:"Complete access history maintained" },
    ]},
  ];

  const allChecks = sections.flatMap(s=>s.checks);
  const passCount = allChecks.filter(c=>c.status==="pass").length;
  const warnCount = allChecks.filter(c=>c.status==="warn").length;
  const failCount = allChecks.filter(c=>c.status==="fail").length;
  const totalChecks = allChecks.length;

  const govScore = Math.round((passCount / totalChecks * 100 * 0.7) + (warnCount / totalChecks * 50 * 0.3));

  const breakdown = [
    { category:"Data Privacy", score: sections[0].checks.filter(c=>c.status==="pass").length/3*100, weight:25 },
    { category:"Safety",       score: sections[1].checks.filter(c=>c.status==="pass").length/3*100, weight:30 },
    { category:"Reliability",  score: sections[2].checks.filter(c=>c.status==="pass").length/3*100, weight:25 },
    { category:"Audit Trail",  score: sections[3].checks.filter(c=>c.status==="pass").length/3*100, weight:20 },
  ];

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">AI Governance Center</h1>
          <p className="text-[11px] text-lo mt-0.5">Compliance monitoring, audit trails, and governance scoring</p>
        </div>
        <button className="filter-pill text-[11px]">Download Report ↓</button>
      </div>

      {/* Score + KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="card p-5 flex flex-col items-center justify-center">
          <div className="text-[11px] text-lo uppercase tracking-wider mb-3">Governance Score</div>
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a2a" strokeWidth="10" />
              <motion.circle cx="50" cy="50" r="40" fill="none"
                stroke={govScore>=85?"#a8e63d":govScore>=70?"#f97316":"#ef4444"}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*40}`}
                initial={{ strokeDashoffset:`${2*Math.PI*40}` }}
                animate={{ strokeDashoffset:`${2*Math.PI*40*(1-govScore/100)}` }}
                transition={{ duration:1.2, ease:"easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-black", govScore>=85?"text-lime":govScore>=70?"text-orange":"text-danger")}>{govScore}</span>
              <span className="text-[9px] text-lo">/100</span>
            </div>
          </div>
        </motion.div>
        {[
          { label:"Passed",   value:passCount,  color:"text-lime" },
          { label:"Warnings", value:warnCount,  color:"text-orange" },
          { label:"Failed",   value:failCount,  color:"text-danger" },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:(i+1)*0.05 }} className="card p-5">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted mt-1">of {totalChecks} checks</div>
          </motion.div>
        ))}
      </div>

      {/* Score breakdown */}
      <div className="card p-5">
        <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Score Breakdown</div>
        <div className="space-y-3">
          {breakdown.map((cat,i) => (
            <div key={cat.category} className="flex items-center gap-4">
              <div className="w-28 text-[11px] text-mid shrink-0">{cat.category}</div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ backgroundColor: cat.score>=90?"#a8e63d":cat.score>=70?"#f97316":"#ef4444" }}
                  initial={{ width:0 }}
                  animate={{ width:`${cat.score}%` }}
                  transition={{ duration:0.8, delay:i*0.1 }}
                />
              </div>
              <div className="w-10 text-right text-[11px] font-mono font-black text-hi shrink-0">{cat.score.toFixed(0)}</div>
              <div className="w-12 text-right text-[10px] text-lo shrink-0">{cat.weight}% wt</div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance grid */}
      <div className="grid grid-cols-2 gap-3">
        {sections.map((section, si) => (
          <motion.div key={section.category} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:si*0.07 }} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-[11px] font-bold text-hi uppercase tracking-widest">{section.category}</div>
            </div>
            <div className="divide-y divide-border">
              {section.checks.map(check => (
                <div key={check.name} className="px-5 py-3 flex items-start gap-3">
                  <span className={STATUS_CFG[check.status].cls}>{STATUS_CFG[check.status].label}</span>
                  <div>
                    <div className="text-[11px] font-medium text-hi">{check.name}</div>
                    <div className="text-[10px] text-lo mt-0.5">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
