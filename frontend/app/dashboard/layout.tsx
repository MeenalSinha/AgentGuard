"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const SIDEBAR_ITEMS = [
  { href: "/dashboard",                  icon: "◈", title: "Overview" },
  { href: "/dashboard/agents",           icon: "⊞", title: "Agents" },
  { href: "/dashboard/drift",            icon: "⊿", title: "Drift Detection" },
  { href: "/dashboard/hallucinations",   icon: "⊘", title: "Hallucinations" },
  { href: "/dashboard/incidents",        icon: "◉", title: "Incidents" },
  { href: "/dashboard/predictions",      icon: "◈", title: "Predictions" },
  { href: "/dashboard/investigation",    icon: "◫", title: "LangGraph" },
  { href: "/dashboard/observability",    icon: "◎", title: "Observability" },
  { href: "/dashboard/copilot",          icon: "✦", title: "AI Copilot" },
  { href: "/dashboard/executive",        icon: "◆", title: "Executive" },
  { href: "/dashboard/governance",       icon: "◇", title: "Governance" },
  { href: "/dashboard/simulator",        icon: "⚡", title: "Simulator" },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/settings", icon: "⚙", title: "Settings" },
];

const TOP_NAV = [
  { href: "/dashboard",               label: "Overview",       icon: "◈" },
  { href: "/dashboard/agents",        label: "Agents",         icon: "⊞" },
  { href: "/dashboard/investigation", label: "LangGraph",      icon: "◫" },
  { href: "/dashboard/observability", label: "Phoenix",        icon: "◎" },
  { href: "/dashboard/copilot",       label: "Copilot",        icon: "✦" },
  { href: "/dashboard/simulator",     label: "Simulator",      icon: "⚡" },
];

const PAGE_LABELS: Record<string, string> = {
  "/dashboard":                  "OVERVIEW",
  "/dashboard/agents":           "AGENTS",
  "/dashboard/drift":            "DRIFT DETECTION",
  "/dashboard/hallucinations":   "HALLUCINATIONS",
  "/dashboard/incidents":        "INCIDENTS",
  "/dashboard/predictions":      "PREDICTIONS",
  "/dashboard/investigation":    "LANGGRAPH",
  "/dashboard/observability":    "OBSERVABILITY",
  "/dashboard/copilot":          "AI COPILOT",
  "/dashboard/executive":        "EXECUTIVE",
  "/dashboard/governance":       "GOVERNANCE",
  "/dashboard/simulator":        "SIMULATOR",
  "/dashboard/settings":         "SETTINGS",
};

const PAGE_BADGE: Record<string, { label: string; color: string }> = {
  "/dashboard/simulator":     { label: "JUDGE DEMO", color: "#a8e63d" },
  "/dashboard/investigation": { label: "AUTONOMOUS",  color: "#a8e63d" },
  "/dashboard/observability": { label: "ARIZE PHOENIX", color: "#a78bfa" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname || ""] || pathname?.split("/").pop()?.toUpperCase() || "DASHBOARD";
  const pageBadge = PAGE_BADGE[pathname || ""];

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* Icon-only left sidebar */}
      <aside className="w-[80px] shrink-0 flex flex-col items-center py-6 gap-4 bg-base z-30">
        <Link href="/dashboard">
          <div className="w-9 h-9 rounded-xl bg-lime flex items-center justify-center mb-2 shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
            <span className="text-black font-black text-xs tracking-tight">AG</span>
          </div>
        </Link>
        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto w-full items-center" style={{ scrollbarWidth: "none" }}>
          {SIDEBAR_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            const isSpecial = ["/dashboard/simulator", "/dashboard/investigation", "/dashboard/observability"].includes(item.href);
            return (
              <Link key={item.href} href={item.href} title={item.title}>
                <div className={cn("icon-btn", active && "active")}
                  style={isSpecial && active ? { borderColor: "rgba(168,230,61,0.4)", color: "#a8e63d" } : {}}>
                  <span className="text-sm">{item.icon}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2">
          {BOTTOM_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} title={item.title}>
              <div className="icon-btn"><span className="text-sm">{item.icon}</span></div>
            </Link>
          ))}
          <div className="icon-btn mt-1"><span className="text-base text-mid">+</span></div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header className="h-[80px] shrink-0 flex items-center justify-between px-8 bg-base mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-black text-hi uppercase tracking-widest">{pageLabel}</h1>
            {pageBadge && (
              <span className="text-[10px] font-bold px-3 py-1 rounded-full"
                style={{ background: `${pageBadge.color}18`, color: pageBadge.color, border: `1px solid ${pageBadge.color}33` }}>
                {pageBadge.label}
              </span>
            )}
          </div>

          {/* Pill nav */}
          <div className="pill-nav hidden md:flex bg-surface rounded-full p-1 border-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
            {TOP_NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn("pill-nav-item", active && "active")}>
                    <span className="text-xs">{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <div 
              className="filter-pill cursor-pointer hover:bg-surface/80" 
              onClick={() => toast("Global search is indexing...", { icon: "🔍", style: { background: "#18181b", color: "#fff", border: "1px solid #27272a" } })}
            >
              <span>⌕</span><span>Search</span>
            </div>
            <div 
              className="filter-pill hidden lg:flex cursor-pointer hover:bg-surface/80"
              onClick={() => toast("Time-travel filtering coming soon", { icon: "⏱️", style: { background: "#18181b", color: "#fff", border: "1px solid #27272a" } })}
            >
              <span>Date: Now</span><span className="text-muted">▾</span>
            </div>
            <div className="relative ml-2 mr-2">
              <div 
                className="icon-btn cursor-pointer"
                onClick={() => toast.error("3 critical incidents require attention", { style: { background: "#18181b", color: "#fff", border: "1px solid #ef4444" } })}
              >
                <span className="text-xs">⊞</span>
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">3</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className="text-right hidden lg:block">
                <div className="text-xs font-semibold text-hi">Admin</div>
                <div className="text-[10px] text-lo">@agentguard</div>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-base px-8 pb-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
