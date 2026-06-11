"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { copilotApi } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; ts: number; }

const SUGGESTED = [
  "Why did the CodePilot agent degrade recently?",
  "Which agent has the highest hallucination risk?",
  "Compare trust scores across all agents",
  "What caused the most recent incident?",
  "What are the top recommended actions this week?",
  "Which agents are predicted to fail in the next 48 hours?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "AgentGuard Copilot online. I have real-time access to all monitored agents, incidents, drift events, and telemetry. Ask me anything about your AI fleet.",
    ts: Date.now(),
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await copilotApi.chat(history);
      setMessages(prev => [...prev, { role: "assistant", content: res.data.message, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Unable to connect to Copilot — ensure the backend is running and GOOGLE_API_KEY is configured.",
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      textRef.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "calc(100vh - 60px)" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-lime/10 border border-lime/20 flex items-center justify-center">
            <span className="text-lime text-[11px] font-black">AI</span>
          </div>
          <div>
            <div className="text-[13px] font-bold text-hi">AgentGuard Copilot</div>
            <div className="flex items-center gap-1.5 text-[11px] text-lo">
              <span className="dot-healthy" style={{ width:6, height:6 }} />
              Online · Gemini 2.5 · Live fleet access
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }}
              className={`flex gap-3 ${msg.role==="user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-lime text-[10px] font-black">AI</span>
                </div>
              )}
              <div className={`max-w-2xl px-4 py-3 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-raised border border-border text-hi"
                  : "card text-mid"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-raised border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-lo text-[10px] font-bold">U</span>
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
                <span className="text-lime text-[10px] font-black">AI</span>
              </div>
              <div className="card px-4 py-3 rounded-2xl flex items-center gap-1.5">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-lime"
                    animate={{ opacity:[0.3,1,0.3] }}
                    transition={{ duration:1.2, delay:i*0.2, repeat:Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Suggestions — shown only at start */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3 shrink-0">
          <div className="text-[10px] text-lo uppercase tracking-wider mb-2">Suggested queries</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-[11px] px-3 py-1.5 bg-surface border border-border text-mid hover:text-hi hover:border-lime/30 rounded-xl transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-border bg-surface shrink-0">
        <div className="flex items-end gap-3 card rounded-2xl p-3">
          <textarea
            ref={textRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask about agent failures, drift patterns, or reliability analysis..."
            className="flex-1 bg-transparent text-[11px] text-hi placeholder:text-lo outline-none resize-none"
            rows={1}
            style={{ minHeight:20, maxHeight:128 }}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl bg-lime text-black flex items-center justify-center font-black text-[13px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-lime/90 transition-colors">
            ↑
          </button>
        </div>
        <div className="text-[10px] text-lo text-center mt-2">Powered by Gemini 2.5 with live agent telemetry access</div>
      </div>
    </div>
  );
}
