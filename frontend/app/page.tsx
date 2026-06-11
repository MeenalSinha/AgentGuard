"use client";
import { motion } from "framer-motion";
import Link from "next/link";

const FEATURES = [
  { title:"Drift Detection",        desc:"Detect prompt, model, retrieval, and user-intent drift before users are impacted.", color:"#a8e63d" },
  { title:"Hallucination Monitor",  desc:"Scan every output for unsupported claims, fabrications, and missing evidence.",    color:"#f97316" },
  { title:"Root Cause Analysis",    desc:"Autonomous AI-powered investigation generates full incident reports in seconds.",   color:"#a8e63d" },
  { title:"Trust Score",            desc:"Proprietary 0–100 reliability index across accuracy, safety, drift, and cost.",    color:"#f97316" },
  { title:"Failure Prediction",     desc:"ML forecasting identifies agents at risk hours or days before degradation hits.",   color:"#a8e63d" },
  { title:"Multi-Agent Control",    desc:"Monitor your entire AI fleet from a single unified observability control plane.",   color:"#f97316" },
];

const STEPS = [
  { n:"01", title:"Observe",    desc:"Instrument agents with a single SDK call. Traces and metrics flow automatically." },
  { n:"02", title:"Evaluate",   desc:"Every response scored for accuracy, relevance, safety, and cost in real time." },
  { n:"03", title:"Detect",     desc:"Statistical tests flag anomalies the moment they begin — not after damage is done." },
  { n:"04", title:"Investigate",desc:"Gemini-powered root cause analysis delivers a full incident report autonomously." },
  { n:"05", title:"Recommend",  desc:"Actionable fixes ranked by impact, risk, and confidence and delivered immediately." },
];

const STATS = [
  { value:"94%",  label:"Reduction in MTTD" },
  { value:"3.2x", label:"Faster resolution" },
  { value:"$480k",label:"Annual cost avoidance" },
  { value:"99.7%",label:"Detection accuracy" },
];

// Animated network nodes
function NetworkBg() {
  const nodes = [
    {x:50,y:50,r:5},{x:22,y:28,r:3.5},{x:78,y:22,r:4},{x:14,y:68,r:3},
    {x:86,y:62,r:3.5},{x:38,y:82,r:4},{x:65,y:75,r:3},{x:30,y:48,r:3.5},{x:72,y:44,r:3},
  ];
  const edges=[[0,1],[0,2],[0,7],[0,8],[1,3],[2,4],[7,3],[8,5],[5,6],[4,6]];
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
      {edges.map(([a,b],i)=>(
        <motion.line key={i} x1={`${nodes[a].x}%`} y1={`${nodes[a].y}%`} x2={`${nodes[b].x}%`} y2={`${nodes[b].y}%`}
          stroke="#a8e63d" strokeWidth="0.4"
          initial={{ pathLength:0, opacity:0 }}
          animate={{ pathLength:1, opacity:[0,0.5,0.2] }}
          transition={{ duration:2.5, delay:i*0.15, repeat:Infinity, repeatType:"reverse", repeatDelay:2 }}
        />
      ))}
      {nodes.map((n,i)=>(
        <motion.circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r={n.r*0.45}
          fill={i===0?"#a8e63d":"#f97316"}
          initial={{ scale:0, opacity:0 }}
          animate={{ scale:[1,1.4,1], opacity:[0.6,1,0.6] }}
          transition={{ duration:2.8, delay:i*0.2, repeat:Infinity, repeatType:"reverse" }}
        />
      ))}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-hi overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-base/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-lime flex items-center justify-center">
              <span className="text-black font-black text-[11px]">AG</span>
            </div>
            <span className="font-bold text-[13px] tracking-tight">AgentGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[12px] text-lo">
            <a href="#features" className="hover:text-hi transition-colors">Features</a>
            <a href="#how"      className="hover:text-hi transition-colors">How It Works</a>
            <a href="#stats"    className="hover:text-hi transition-colors">Results</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-[12px] text-lo hover:text-hi transition-colors px-3 py-1.5">Sign In</Link>
            <Link href="/sign-up" className="text-[12px] bg-lime text-black font-bold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden"
        style={{ background:"radial-gradient(ellipse at 50% 60%, rgba(168,230,61,0.06) 0%, transparent 70%)" }}>
        {/* Grid background */}
        <div className="absolute inset-0" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize:"40px 40px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-base" />
        <NetworkBg />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.65 }}>
            <div className="inline-flex items-center gap-2 border border-lime/25 bg-lime/5 px-4 py-1.5 rounded-full text-[11px] text-lime mb-8">
              <span className="dot-healthy" style={{width:6,height:6}} />
              Now monitoring 1,200+ AI agents in production
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6">
              The AI That<br />
              <span className="text-lime">Watches</span> Your AI
            </h1>
            <p className="text-[16px] text-mid max-w-2xl mx-auto mb-10 leading-relaxed">
              Continuously monitor deployed AI agents, detect behavioral drift, investigate failures autonomously, and maintain trust at scale.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/dashboard" className="bg-lime text-black font-bold px-8 py-3.5 rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 text-[13px]">
                Start Monitoring
              </Link>
              <Link href="/dashboard" className="border border-border text-hi px-8 py-3.5 rounded-xl hover:bg-surface transition-all text-[13px]">
                View Demo
              </Link>
            </div>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div initial={{ opacity:0, y:50 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.8, delay:0.4 }} className="mt-20 relative">
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-base to-transparent z-10 pointer-events-none" />
            <div className="card overflow-hidden border border-border shadow-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
                <div className="w-3 h-3 rounded-full bg-danger/60" /><div className="w-3 h-3 rounded-full bg-orange/60" /><div className="w-3 h-3 rounded-full bg-lime/60" />
                <span className="text-[10px] text-lo ml-2 font-mono">agentguard.ai/dashboard</span>
              </div>
              <div className="p-4 bg-surface grid grid-cols-4 gap-3">
                {[
                  { l:"Active Agents", v:"20", c:"text-hi" },
                  { l:"Health Score",  v:"87.4", c:"text-lime" },
                  { l:"Drift Events",  v:"7",  c:"text-orange" },
                  { l:"Hallucinations",v:"3",  c:"text-danger" },
                ].map(k => (
                  <div key={k.l} className="card-raised rounded-xl p-3">
                    <div className={`text-2xl font-black ${k.c}`}>{k.v}</div>
                    <div className="text-[10px] text-lo mt-0.5">{k.l}</div>
                  </div>
                ))}
              </div>
              <div className="h-32 bg-surface flex items-center justify-center text-lo text-[11px] border-t border-border">
                Live agent telemetry — 20 agents monitored in real time
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-20 border-y border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s,i) => (
            <motion.div key={s.label} initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ delay:i*0.08 }} className="text-center">
              <div className="text-4xl md:text-5xl font-black text-hi mb-2">{s.value}</div>
              <div className="text-[12px] text-lo">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} className="text-center mb-14">
            <div className="text-[11px] text-lime font-mono mb-3 uppercase tracking-widest">Platform Capabilities</div>
            <h2 className="text-4xl md:text-5xl font-black mb-3">Everything your AI fleet needs</h2>
            <p className="text-mid max-w-lg mx-auto text-[14px]">Built for enterprises operating AI at scale — the complete observability stack.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f,i) => (
              <motion.div key={f.title} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ delay:i*0.07 }}
                className="card p-6 hover:border-border/80 transition-all group cursor-default">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black mb-4"
                  style={{ backgroundColor:`${f.color}18`, color:f.color, border:`1px solid ${f.color}30` }}>
                  {f.title[0]}
                </div>
                <h3 className="font-bold text-hi mb-2 text-[14px]">{f.title}</h3>
                <p className="text-[12px] text-mid leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-surface border-y border-border">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} className="text-center mb-14">
            <div className="text-[11px] text-lime font-mono mb-3 uppercase tracking-widest">How It Works</div>
            <h2 className="text-4xl font-black">Five steps to total AI reliability</h2>
          </motion.div>
          <div className="space-y-3">
            {STEPS.map((s,i) => (
              <motion.div key={s.n} initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ delay:i*0.08 }}
                className="card flex items-center gap-6 p-5">
                <div className="text-3xl font-black text-muted font-mono w-12 shrink-0">{s.n}</div>
                <div>
                  <div className="font-bold text-hi mb-0.5 text-[13px]">{s.title}</div>
                  <div className="text-[12px] text-mid">{s.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden" style={{ background:"radial-gradient(ellipse at 50% 50%, rgba(168,230,61,0.08) 0%, transparent 70%)" }}>
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
            <h2 className="text-5xl md:text-6xl font-black mb-6">
              Your AI agents are running.<br />
              <span className="text-lime">Are they trustworthy?</span>
            </h2>
            <p className="text-mid mb-10 text-[14px]">Join enterprise teams using AgentGuard to ensure AI agents remain accurate, safe, and reliable.</p>
            <Link href="/sign-up" className="inline-block bg-lime text-black font-black px-10 py-4 rounded-xl text-[14px] hover:opacity-90 transition-all hover:scale-105">
              Start Monitoring for Free
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-surface">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-lime flex items-center justify-center">
              <span className="text-black font-black text-[10px]">AG</span>
            </div>
            <span className="text-[12px] font-semibold">AgentGuard</span>
          </div>
          <div className="text-[11px] text-lo">2024 AgentGuard. The AI that watches your AI.</div>
        </div>
      </footer>
    </div>
  );
}
