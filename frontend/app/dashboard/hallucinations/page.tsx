"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { hallucinationsApi } from "@/lib/api";
import { cn, getSeverityClass, timeAgo } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface HEvent {
  id: string; agent_id: string; severity: string; risk_level: number;
  query: string; response_excerpt: string; unsupported_claims: string[];
  missing_evidence: string[]; fabrications: string[]; suggested_fix: string;
  confidence: number; created_at: string; agent_name?: string;
}

const SEV_COLORS: Record<string,string> = { critical:"#ef4444", high:"#f97316", medium:"#eab308", low:"#60a5fa" };

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.fill }}>{p.name}:</span>
          <span className="text-hi">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function HallucinationsPage() {
  const [events, setEvents] = useState<HEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await hallucinationsApi.list({ limit: "100" });
      setEvents(res.data || []);
      if (res.data?.length) setSelected(res.data[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedEvent = events.find(h => h.id === selected);

  // Build pie data from events
  const sevCounts = ["critical","high","medium","low"].map(s => ({
    name: s, value: events.filter(e => e.severity === s).length, color: SEV_COLORS[s],
  })).filter(d => d.value > 0);

  // Build bar data: group by agent
  const agentMap: Record<string, number> = {};
  events.forEach(e => { const key = e.agent_name || e.agent_id.slice(0,8); agentMap[key] = (agentMap[key]||0) + 1; });
  const barData = Object.entries(agentMap).map(([agent, count]) => ({ agent: agent.slice(0,12), count })).sort((a,b) => b.count - a.count).slice(0,8);

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Hallucination Detection Center</h1>
        <p className="text-[11px] text-lo mt-0.5">Automated analysis of fabricated content, unsupported claims, and reasoning failures</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Detected",   value: events.length, color: "text-hi" },
          { label: "Critical / High",  value: events.filter(e => e.severity==="critical"||e.severity==="high").length, color: "text-danger" },
          { label: "Avg Risk Level",   value: events.length ? `${(events.reduce((s,e)=>s+e.risk_level,0)/events.length*100).toFixed(0)}%` : "—", color: "text-orange" },
          { label: "Agents Affected",  value: new Set(events.map(e=>e.agent_id)).size, color: "text-lime" },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }} className="card p-4">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black", s.color)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">By Severity</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={sevCounts} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} dataKey="value">
                {sevCounts.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"12px", fontSize:"11px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {sevCounts.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-mid capitalize">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor:s.color }} />{s.name}: {s.value}
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Rate by Agent</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="agent" type="category" tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" name="Events" fill="#f97316" radius={[0,4,4,0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* List + detail panel */}
      <div className={cn("grid gap-3", selected ? "grid-cols-2" : "grid-cols-1")}>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Detected Events</div>
            <span className="text-[10px] text-lo">{events.length} total</span>
          </div>
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight:420 }}>
            {loading && Array.from({length:5}).map((_,i)=>(
              <div key={i} className="px-5 py-4 opacity-40"><div className="h-4 bg-surface rounded animate-pulse" /></div>
            ))}
            {!loading && events.length===0 && (
              <div className="px-5 py-10 text-center text-lo text-[12px]">No hallucination events — seed database first</div>
            )}
            {events.map((h,i) => (
              <motion.div key={h.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.03 }}
                onClick={() => setSelected(selected===h.id?null:h.id)}
                className={cn("px-5 py-4 cursor-pointer transition-colors", selected===h.id?"bg-surface":"hover:bg-surface")}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[11px] font-semibold text-hi">{h.agent_name || h.agent_id.slice(0,10)}</span>
                      <span className={cn("text-[10px] capitalize font-medium", getSeverityClass(h.severity))}>{h.severity}</span>
                      <span className="ml-auto text-[10px] text-lo">{timeAgo(h.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-lo truncate">{h.query}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${h.risk_level*100}%`, backgroundColor: h.risk_level>0.7?"#ef4444":h.risk_level>0.4?"#f97316":"#eab308" }} />
                      </div>
                      <span className="text-[10px] text-mid">Risk: {(h.risk_level*100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {selectedEvent && (
          <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} className="card p-5 space-y-4 overflow-y-auto" style={{ maxHeight:540 }}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Investigation Detail</div>
              <button onClick={() => setSelected(null)} className="text-[10px] text-lo hover:text-hi">Close</button>
            </div>
            <div className="p-3 bg-raised rounded-xl">
              <div className="text-[10px] text-lo mb-1">Query</div>
              <div className="text-[11px] text-hi">{selectedEvent.query}</div>
            </div>
            <div className="p-3 bg-raised rounded-xl">
              <div className="text-[10px] text-lo mb-1">Response Excerpt</div>
              <div className="text-[11px] text-mid italic">{selectedEvent.response_excerpt}</div>
            </div>
            {selectedEvent.unsupported_claims.length > 0 && (
              <div>
                <div className="text-[10px] text-lo mb-2 uppercase tracking-wider">Unsupported Claims</div>
                {selectedEvent.unsupported_claims.map((c,i) => (
                  <div key={i} className="flex gap-2 text-[11px] text-orange mb-1"><span>—</span>{c}</div>
                ))}
              </div>
            )}
            {selectedEvent.fabrications.length > 0 && (
              <div>
                <div className="text-[10px] text-lo mb-2 uppercase tracking-wider">Fabrications</div>
                {selectedEvent.fabrications.map((f,i) => (
                  <div key={i} className="flex gap-2 text-[11px] text-danger mb-1"><span>—</span>{f}</div>
                ))}
              </div>
            )}
            {selectedEvent.missing_evidence.length > 0 && (
              <div>
                <div className="text-[10px] text-lo mb-2 uppercase tracking-wider">Missing Evidence</div>
                {selectedEvent.missing_evidence.map((e,i) => (
                  <div key={i} className="flex gap-2 text-[11px] text-mid mb-1"><span>—</span>{e}</div>
                ))}
              </div>
            )}
            {selectedEvent.suggested_fix && (
              <div className="p-3 bg-lime/5 border border-lime/20 rounded-xl">
                <div className="text-[10px] text-lime mb-1 uppercase tracking-wider">Suggested Fix</div>
                <div className="text-[11px] text-mid">{selectedEvent.suggested_fix}</div>
              </div>
            )}
            <div className="text-[10px] text-lo">Confidence: <span className="text-hi">{(selectedEvent.confidence*100).toFixed(0)}%</span></div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
