"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { incidentsApi } from "@/lib/api";
import { cn, getSeverityClass, timeAgo } from "@/lib/utils";

interface TimelineEvent { time: string; event: string; type: string; }
interface Incident {
  id: string; agent_id: string; title: string; severity: string; status: string;
  root_cause: string; impact_assessment: string; recommended_actions: string[];
  investigation_confidence: number; timeline_events: TimelineEvent[];
  started_at: string; resolved_at: string | null; created_at: string;
  agent_name?: string;
}

const TYPE_COLOR: Record<string,string> = { info:"#60a5fa", warning:"#f97316", critical:"#ef4444", resolved:"#a8e63d" };
const TYPE_BG: Record<string,string>    = { info:"bg-blue-400/10 border-blue-400/20", warning:"bg-orange/10 border-orange/20", critical:"bg-danger/10 border-danger/20", resolved:"bg-lime/10 border-lime/20" };

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await incidentsApi.list({ limit: "50" });
      setIncidents(res.data || []);
      if (res.data?.length) setSelected(res.data[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const incident = incidents.find(i => i.id === selected);

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Incident Timeline</h1>
        <p className="text-[11px] text-lo mt-0.5">Autonomous root cause analysis and investigation workflows</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Open",        value: incidents.filter(i=>i.status==="open").length,         color:"text-danger" },
          { label: "Investigating",value: incidents.filter(i=>i.status==="investigating").length, color:"text-orange" },
          { label: "Resolved",    value: incidents.filter(i=>i.status==="resolved").length,      color:"text-lime" },
          { label: "Total",       value: incidents.length,                                        color:"text-hi" },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }} className="card p-4">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* List + Detail */}
      <div className="grid grid-cols-3 gap-4">
        {/* Incident list */}
        <div className="card overflow-hidden">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest px-5 py-4 border-b border-border">
            {incidents.length} Incidents
          </div>
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight:620 }}>
            {loading && Array.from({length:4}).map((_,i)=>(
              <div key={i} className="px-5 py-4 opacity-40"><div className="h-10 bg-surface rounded animate-pulse" /></div>
            ))}
            {!loading && incidents.length===0 && (
              <div className="px-5 py-10 text-center text-lo text-[12px]">No incidents — seed database first</div>
            )}
            {incidents.map(inc => (
              <div key={inc.id} onClick={() => setSelected(inc.id)}
                className={cn("px-5 py-4 cursor-pointer transition-colors", selected===inc.id?"bg-surface":"hover:bg-surface")}>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: inc.severity==="critical"?"#ef4444":inc.severity==="high"?"#f97316":"#eab308" }} />
                  <div>
                    <div className="text-[11px] font-medium text-hi leading-relaxed mb-1">{inc.title}</div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] capitalize", getSeverityClass(inc.severity))}>{inc.severity}</span>
                      <span className="text-muted text-[10px]">·</span>
                      <span className={cn("text-[10px] capitalize",
                        inc.status==="resolved"?"text-lime":inc.status==="investigating"?"text-orange":"text-danger"
                      )}>{inc.status}</span>
                    </div>
                    <div className="text-[10px] text-lo mt-0.5">{timeAgo(inc.started_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {incident ? (
          <motion.div key={incident.id} initial={{ opacity:0 }} animate={{ opacity:1 }} className="col-span-2 space-y-3 overflow-y-auto" style={{ maxHeight:680 }}>
            {/* Header */}
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className={cn("badge capitalize",
                  incident.severity==="critical"?"badge-danger":incident.severity==="high"?"badge-warning":"badge-neutral"
                )}>{incident.severity}</span>
                <span className={cn("badge capitalize",
                  incident.status==="resolved"?"badge-healthy":incident.status==="investigating"?"badge-warning":"badge-danger"
                )}>{incident.status}</span>
                <span className="text-[10px] text-lo ml-auto">Confidence: <span className="text-hi">{((incident.investigation_confidence||0)*100).toFixed(0)}%</span></span>
              </div>
              <h2 className="text-[13px] font-bold text-hi mb-1">{incident.title}</h2>
              <p className="text-[10px] text-lo">{incident.agent_name || incident.agent_id?.slice(0,10)} · {timeAgo(incident.started_at)}</p>
            </div>

            {/* Root cause */}
            {incident.root_cause && (
              <div className="card p-5">
                <div className="text-[10px] font-bold text-orange uppercase tracking-wider mb-2">Root Cause</div>
                <p className="text-[11px] text-mid leading-relaxed">{incident.root_cause}</p>
              </div>
            )}

            {/* Impact */}
            {incident.impact_assessment && (
              <div className="card p-5">
                <div className="text-[10px] font-bold text-hi uppercase tracking-wider mb-2">Impact Assessment</div>
                <p className="text-[11px] text-mid leading-relaxed">{incident.impact_assessment}</p>
              </div>
            )}

            {/* Timeline */}
            {incident.timeline_events?.length > 0 && (
              <div className="card p-5">
                <div className="text-[10px] font-bold text-hi uppercase tracking-wider mb-4">Incident Timeline</div>
                <div className="relative space-y-0">
                  <div className="absolute left-[38px] top-3 bottom-3 w-px bg-border" />
                  {incident.timeline_events.map((ev,i) => (
                    <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                      className="flex items-start gap-3 relative pb-3 last:pb-0">
                      <div className="w-14 shrink-0 text-right">
                        <span className="text-[10px] text-lo font-mono">{ev.time}</span>
                      </div>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 relative z-10"
                        style={{ backgroundColor: TYPE_COLOR[ev.type] || "#71717a" }} />
                      <div className={cn("flex-1 text-[11px] px-3 py-1.5 rounded-xl border", TYPE_BG[ev.type] || "bg-surface border-border")}
                        style={{ color: TYPE_COLOR[ev.type] || "#a1a1aa" }}>
                        {ev.event}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {incident.recommended_actions?.length > 0 && (
              <div className="card p-5">
                <div className="text-[10px] font-bold text-lime uppercase tracking-wider mb-3">Recommended Actions</div>
                <div className="space-y-2">
                  {incident.recommended_actions.map((action,i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-lime/5 border border-lime/15 rounded-xl">
                      <span className="text-[10px] text-lime font-mono shrink-0">{String(i+1).padStart(2,"0")}</span>
                      <span className="text-[11px] text-mid flex-1">{action}</span>
                      <button className="text-[10px] text-lime hover:text-lime/80 shrink-0">Apply</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="col-span-2 card flex items-center justify-center text-lo text-[12px]">
            Select an incident to view details
          </div>
        )}
      </div>
    </div>
  );
}
