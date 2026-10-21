"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "@/context/AccountContext";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Compass,
  TrendingUp,
  Flame,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Hash
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export default function ChatPage() {
  const { activeHandle, account, posts, nicheInfo, isDetectingNiche } = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasPosts = posts && posts.length > 0;
  const primaryNiche = nicheInfo?.primary_niche || (hasPosts ? "Video Editing & Visual Arts" : "Unassigned");

  // Initial greeting tailored to whether creator has posts or needs onboarding
  useEffect(() => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (!hasPosts) {
      setMessages([
        {
          id: "welcome-0-post",
          role: "model",
          text: `Welcome to Entangled Echo, **@${activeHandle}**! 🚀\n\nI see you don't have any posts on your profile yet. That's a huge opportunity — we have a blank canvas to build your algorithmic momentum from Day 1.\n\nLet's run a quick **Niche Discovery Interview**:\n1. **What are 2-3 topics or skills you are most excited about?** *(e.g. video editing, tech/coding, gym, comedy, gaming)*\n2. **What's your creation style?** *(Talking to camera, screen recordings, faceless aesthetic edits, or carousels?)*\n3. **Who do you want to reach?**\n\nReply below and I'll build your custom starter blueprint!`,
          timestamp: timeStr,
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome-active",
          role: "model",
          text: `Hey **@${activeHandle}**! 👋 I've analyzed your verified content and identified your primary niche as **${primaryNiche}** (${nicheInfo?.sub_niche || "Creative Editing"}).\n\nHow can I help you grow today?\n- Brainstorm viral Reel hooks\n- Jack into today's live Google Trends\n- Structure your next 3 high-retention posts`,
          timestamp: timeStr,
        },
      ]);
    }
  }, [activeHandle, hasPosts, primaryNiche, nicheInfo?.sub_niche]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      // Build history for backend
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          account: {
            handle: activeHandle,
            followers: account?.follower_count || 207,
            has_posts: hasPosts,
          },
          niche_info: nicheInfo,
        }),
      });

      const data = await res.json();
      if (data.status === "success" || data.reply) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "model",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = !hasPosts
    ? [
        "I love short video editing and tutorials. Help me pick my niche!",
        "I want to make tech and AI tips content. What should my first post be?",
        "Give me a 3-post starter blueprint for a brand new creator.",
      ]
    : [
        "What are today's top Google Trends that fit my niche?",
        "Give me 3 viral Reel hooks with high-retention transitions.",
        "What content pillars should I post this week for maximum comments?",
      ];

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 px-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#373E3E] to-slate-900 text-white flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                AI Creator Strategist
              </h1>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Personalized growth advisor for <strong>@{activeHandle}</strong>
            </p>
          </div>
        </div>

        {/* Niche Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs">
            <span className="text-slate-500">Niche: </span>
            <span className="font-bold text-slate-800">
              {isDetectingNiche ? "Detecting..." : primaryNiche}
            </span>
          </div>
          {!hasPosts && (
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-600" /> Niche Discovery Mode
            </span>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-50/30">
        {messages.map((m) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser
                    ? "bg-[#373E3E] text-white"
                    : "bg-white border border-slate-200 text-emerald-600 shadow-sm"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-2 shadow-sm ${
                  isUser
                    ? "bg-[#373E3E] text-white rounded-tr-none"
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-none whitespace-pre-wrap font-sans"
                }`}
              >
                <div>{m.text}</div>
                <div
                  className={`text-[10px] text-right pt-1 ${
                    isUser ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 text-xs text-slate-500 flex items-center gap-2 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              Gemini is formulating your strategy...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-6 py-2.5 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
          Suggestions:
        </span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(qp)}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors border border-slate-200/80 font-medium"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 px-6 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={
              !hasPosts
                ? "Answer the 3 interview questions or ask about niches..."
                : `Ask your AI strategist about @${activeHandle}'s content or trends...`
            }
            className="flex-1 bg-slate-50 text-xs text-slate-800 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-action bg-[#373E3E] text-white hover:bg-black py-3 px-5 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
