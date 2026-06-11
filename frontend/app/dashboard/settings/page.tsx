"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { observabilityApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = ["General","Alerts","Integrations","API Keys","Team"];

export default function SettingsPage() {
  const [tab, setTab] = useState("General");
  const [alerts, setAlerts] = useState({ drift:true, hallucination:true, latency:true, trust_drop:true });
  const [phoenixStatus, setPhoenixStatus] = useState<{ connected:boolean; endpoint:string } | null>(null);

  const loadPhoenix = useCallback(async () => {
    try {
      const res = await observabilityApi.status();
      setPhoenixStatus(res.data);
    } catch { setPhoenixStatus({ connected:false, endpoint:"http://localhost:6006" }); }
  }, []);

  useEffect(() => { if (tab==="Integrations") loadPhoenix(); }, [tab, loadPhoenix]);

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">Settings</h1>
        <p className="text-[11px] text-lo mt-0.5">Configure AgentGuard for your organization</p>
      </div>

      <div className="pill-nav w-fit">
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)} className={cn("pill-nav-item", tab===t&&"active")}>{t}</button>
        ))}
      </div>

      {tab==="General" && (
        <div className="space-y-3">
          <div className="card p-5 space-y-4">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Organization</div>
            {[
              { label:"Organization Name", value:"Acme Corp", type:"text" },
              { label:"Industry", value:"Technology", type:"text" },
              { label:"Primary Contact", value:"admin@acme.com", type:"email" },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <label className="text-[11px] text-mid">{f.label}</label>
                <input defaultValue={f.value} type={f.type}
                  className="bg-raised border border-border rounded-xl px-3 py-2 text-[11px] text-hi outline-none focus:border-lime/40 w-52" />
              </div>
            ))}
          </div>
          <div className="card p-5 space-y-4">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Trust Score Thresholds</div>
            {[
              { label:"Healthy threshold", value:"85" },
              { label:"Warning threshold", value:"70" },
              { label:"Critical threshold", value:"60" },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <label className="text-[11px] text-mid">{f.label}</label>
                <input defaultValue={f.value} type="number"
                  className="bg-raised border border-border rounded-xl px-3 py-2 text-[11px] text-hi outline-none focus:border-lime/40 w-24 text-right" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="Alerts" && (
        <div className="card p-5 space-y-4">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Alert Configuration</div>
          {[
            { key:"drift",        label:"Drift Detection Alerts",     desc:"Alert when drift score exceeds threshold" },
            { key:"hallucination",label:"Hallucination Alerts",        desc:"Alert on high-risk hallucination events" },
            { key:"latency",      label:"Latency Regression Alerts",   desc:"Alert when P99 latency exceeds SLA" },
            { key:"trust_drop",   label:"Trust Score Drop Alerts",     desc:"Alert when trust score drops more than 5 points" },
          ].map(a => (
            <div key={a.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <div className="text-[11px] font-medium text-hi">{a.label}</div>
                <div className="text-[10px] text-lo">{a.desc}</div>
              </div>
              <button onClick={()=>setAlerts(p=>({...p,[a.key]:!p[a.key as keyof typeof p]}))}
                className={cn("w-10 h-5 rounded-full transition-colors relative shrink-0",
                  alerts[a.key as keyof typeof alerts]?"bg-lime":"bg-raised border border-border"
                )}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow",
                  alerts[a.key as keyof typeof alerts]?"left-5":"left-0.5"
                )} />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab==="Integrations" && (
        <div className="space-y-3">
          {[
            { name:"Arize Phoenix", desc:"Traces, evaluations, prompt monitoring", connected: phoenixStatus?.connected ?? false, endpoint: phoenixStatus?.endpoint },
            { name:"Slack", desc:"Alert notifications to Slack channels", connected: false },
            { name:"PagerDuty", desc:"Critical incident escalation", connected: false },
            { name:"Datadog", desc:"Export metrics to Datadog", connected: false },
            { name:"Google Cloud Run", desc:"Backend deployment target", connected: true },
          ].map(i => (
            <div key={i.name} className="card p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-hi">{i.name}</div>
                <div className="text-[10px] text-lo">{i.desc}</div>
                {i.endpoint && <div className="text-[10px] text-lime font-mono mt-0.5">{i.endpoint}</div>}
              </div>
              <div className={cn("text-[11px] px-3 py-1.5 rounded-xl border cursor-pointer transition-all",
                i.connected ? "text-lime bg-lime/10 border-lime/20" : "text-mid bg-raised border-border hover:border-lime/30"
              )}>
                {i.connected ? "Connected" : "Connect"}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="API Keys" && (
        <div className="card p-5 space-y-4">
          <div className="text-[11px] font-bold text-hi uppercase tracking-widest">API Keys</div>
          {[
            { label:"AgentGuard API Key", value:"ag_live_••••••••••••••••" },
            { label:"Google AI (Gemini)", value:"AIza••••••••••••••••••••" },
            { label:"Clerk Secret Key",  value:"sk_live_••••••••••••••••" },
          ].map(k => (
            <div key={k.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <div className="text-[11px] text-mid">{k.label}</div>
                <div className="text-[10px] font-mono text-lo mt-0.5">{k.value}</div>
              </div>
              <button className="text-[11px] text-lime hover:text-lime/80 transition-colors">Rotate</button>
            </div>
          ))}
          <button className="text-[11px] bg-lime text-black font-bold px-4 py-2 rounded-btn hover:opacity-90 transition-opacity">
            Generate New Key
          </button>
        </div>
      )}

      {tab==="Team" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="text-[11px] font-bold text-hi uppercase tracking-widest">Team Members</div>
            <button className="text-[11px] bg-lime text-black font-bold px-3 py-1.5 rounded-btn">Invite</button>
          </div>
          <div className="divide-y divide-border">
            {[
              { name:"Admin User",   email:"admin@acme.com",  role:"Owner" },
              { name:"Alice Chen",   email:"alice@acme.com",  role:"Admin" },
              { name:"Bob Park",     email:"bob@acme.com",    role:"Viewer" },
              { name:"Carol Smith",  email:"carol@acme.com",  role:"Viewer" },
            ].map(u => (
              <div key={u.email} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-raised border border-border flex items-center justify-center text-[11px] font-bold text-mid">{u.name[0]}</div>
                  <div>
                    <div className="text-[11px] font-medium text-hi">{u.name}</div>
                    <div className="text-[10px] text-lo">{u.email}</div>
                  </div>
                </div>
                <span className="text-[10px] text-mid bg-raised px-2.5 py-1 rounded-full border border-border">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
