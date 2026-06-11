import { create } from "zustand";

interface Agent {
  id: string;
  name: string;
  agent_type: string;
  status: string;
  trust_score: number;
  accuracy: number;
  relevance: number;
  avg_latency_ms: number;
  cost_per_query: number;
  total_cost_month: number;
  user_satisfaction: number;
  drift_score: number;
  total_conversations: number;
  hallucination_rate: number;
  owner: string;
  environment: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

interface DashboardKPIs {
  active_agents: number;
  avg_health_score: number;
  drift_events_today: number;
  hallucination_alerts_today: number;
  total_monthly_cost: number;
  avg_response_quality: number;
  critical_incidents: number;
  agents_at_risk: number;
}

interface FeedEvent {
  id: string;
  type: "drift" | "hallucination" | "incident" | "latency";
  severity: "low" | "medium" | "high" | "critical";
  agent: string;
  message: string;
  timestamp: string;
}

interface AgentGuardStore {
  agents: Agent[];
  selectedAgent: Agent | null;
  kpis: DashboardKPIs | null;
  liveFeed: FeedEvent[];
  sidebarCollapsed: boolean;

  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setKPIs: (kpis: DashboardKPIs) => void;
  setLiveFeed: (feed: FeedEvent[]) => void;
  setSidebarCollapsed: (v: boolean) => void;
  addFeedEvent: (event: FeedEvent) => void;
}

export const useStore = create<AgentGuardStore>((set) => ({
  agents: [],
  selectedAgent: null,
  kpis: null,
  liveFeed: [],
  sidebarCollapsed: false,

  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setKPIs: (kpis) => set({ kpis }),
  setLiveFeed: (feed) => set({ liveFeed: feed }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  addFeedEvent: (event) =>
    set((state) => ({ liveFeed: [event, ...state.liveFeed].slice(0, 50) })),
}));
