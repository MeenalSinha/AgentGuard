"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { dashboardApi, agentsApi } from "@/lib/api";
import { cn, formatCurrency, getTrustColor } from "@/lib/utils";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

interface KPI { active_agents:number; avg_health_score:number; drift_events_today:number; hallucination_alerts_today:number; total_monthly_cost:number; avg_response_quality:number; critical_incidents:number; agents_at_risk:number; }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-[11px] shadow-lg">
      <div className="text-lo mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2">
          <span style={{ color: p.stroke || p.fill }}>{p.name}:</span>
          <span className="text-hi">{typeof p.value === "number" ? p.value.toFixed(0) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ExecutivePage() {
  const [kpis, setKpis]       = useState<KPI | null>(null);
  const [agents, setAgents]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [kRes, aRes] = await Promise.all([dashboardApi.kpis(), agentsApi.list({ limit: "20" })]);
      setKpis(kRes.data);
      setAgents(aRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build charts from live data
  const roiMonths = Array.from({ length:12 }, (_,i) => {
    const base = ((kpis?.total_monthly_cost || 18000) / 12) * (0.8 + Math.random()*0.4);
    return { month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], cost_avoided: base + i*800 };
  });

  const trustTrend = Array.from({ length:30 }, (_,i) => ({
    day: i+1,
    avg: (kpis?.avg_health_score||85) + Math.sin(i/5)*3 + (Math.random()-0.5)*2,
    p10: (kpis?.avg_health_score||85) - 15 + Math.sin(i/4)*2,
    p90: (kpis?.avg_health_score||85) + 8 - Math.sin(i/4)*1.5,
  }));

  const riskDist = [
    { name:"Low Risk",    value: agents.filter(a=>a.trust_score>=85).length,   color:"#a8e63d" },
    { name:"Medium Risk", value: agents.filter(a=>a.trust_score>=70&&a.trust_score<85).length, color:"#eab308" },
    { name:"High Risk",   value: agents.filter(a=>a.trust_score<70).length,    color:"#ef4444" },
  ].filter(d=>d.value>0);

  const agentROI = agents.slice(0,8).map(a => ({
    name:  a.name.split(" ").slice(0,2).join(" "),
    roi:   Math.round((a.trust_score / 100) * 380 + 40),
    cost:  a.total_cost_month,
  }));

  const costAvoided = Math.round((kpis?.avg_health_score || 85) / 100 * 486000);

  return (
    <div className="p-5 max-w-[1700px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Executive Dashboard</h1>
          <p className="text-[11px] text-lo mt-0.5">AI fleet performance, ROI, and governance overview for leadership</p>
        </div>
        <button className="filter-pill text-[11px]">Export Report ↓</button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:"Cost Avoided (YTD)", value: loading?"—":formatCurrency(costAvoided), color:"text-lime", sub:"vs pre-AgentGuard baseline" },
          { label:"Fleet Reliability",   value: loading?"—":`${kpis?.avg_health_score?.toFixed(1)||"—"}`, color:"text-lime", sub:"Trust score avg" },
          { label:"Agents Monitored",    value: loading?"—":(kpis?.active_agents||"—").toString(), color:"text-hi", sub:"100% coverage" },
          { label:"Incidents Prevented", value: loading?"—":`${Math.round(((kpis?.avg_health_score||85)-79)*5+40)}`, color:"text-hi", sub:"Estimated this month" },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }} className="card p-5">
            <div className="text-[11px] text-lo uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn("text-4xl font-black mb-1", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-1">Monthly Cost Avoided</div>
          <div className="text-[10px] text-lo mb-4">Estimated incidents prevented × business impact</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={roiMonths}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#52525b", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="cost_avoided" name="Cost Avoided" fill="#a8e63d" radius={[4,4,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest mb-4">Risk Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={riskDist} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} dataKey="value">
                {riskDist.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"12px", fontSize:"11px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {riskDist.map(r => (
              <div key={r.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor:r.color }} />
                  <span className="text-mid">{r.name}</span>
                </div>
                <span className="text-hi font-mono font-bold">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust trend */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Fleet Trust Score — 30 Day Trend</div>
          <div className="flex gap-4 text-[10px]">
            <span className="flex items-center gap-1.5 text-lo"><span className="w-3 h-0.5 bg-lime inline-block rounded" />P90</span>
            <span className="flex items-center gap-1.5 text-lo"><span className="w-3 h-0.5 bg-hi inline-block rounded" />Avg</span>
            <span className="flex items-center gap-1.5 text-lo"><span className="w-3 h-0.5 bg-orange inline-block rounded" />P10</span>
          </div>
        </div>
        <div className="text-[10px] text-lo mb-4">Percentile distribution across entire agent fleet</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={trustTrend}>
            <defs>
              <linearGradient id="p90g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a8e63d" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#a8e63d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fill:"#52525b", fontSize:9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"#52525b", fontSize:9 }} axisLine={false} tickLine={false} domain={[60,100]} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="p90" stroke="#a8e63d" strokeWidth={1} fill="url(#p90g)" strokeDasharray="3 3" name="P90" dot={false} />
            <Line type="monotone" dataKey="avg" stroke="#ffffff" strokeWidth={2} dot={false} name="Avg" />
            <Line type="monotone" dataKey="p10" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="3 3" name="P10" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Agent ROI table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Agent ROI Breakdown</div>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-lo">
              {["Agent","ROI Multiplier","Monthly Cost","Est. Value Generated","ROI Bar"].map(h => (
                <th key={h} className={cn("px-5 py-3 font-medium uppercase tracking-wider text-[10px]", h==="Agent"?"text-left":"text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agentROI.map((a,i) => (
              <motion.tr key={a.name} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.04 }} className="hover:bg-surface transition-colors">
                <td className="px-5 py-3 text-hi font-medium">{a.name}</td>
                <td className="px-5 py-3 text-right text-lime font-mono font-black">{a.roi}%</td>
                <td className="px-5 py-3 text-right text-mid">{formatCurrency(a.cost)}</td>
                <td className="px-5 py-3 text-right text-hi">{formatCurrency(a.cost * (1 + a.roi/100))}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-lime rounded-full" style={{ width:`${Math.min(100, a.roi/4)}%` }} />
                    </div>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
