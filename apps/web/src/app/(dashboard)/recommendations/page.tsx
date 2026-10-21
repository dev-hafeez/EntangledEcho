"use client";

import { useState } from "react";
import { useAccount } from "@/context/AccountContext";
import { Sparkles, ThumbsUp, ThumbsDown, Check, Copy, Clock, Layers } from "lucide-react";

export default function RecommendationsPage() {
  const { activeHandle, posts } = useAccount();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "accepted" | "rejected">>({});

  const sampleRecommendations = [
    {
      id: 1,
      type: "caption",
      title: "High-Saves Carousel Draft",
      tone: "Educational & Authoritative",
      confidence: 94,
      text: "The 3 biggest bottlenecks in content scaling (and how AI automation fixes them). Save this for your next strategy session! 🚀",
      hashtags: ["#contentstrategy", "#creatoreconomy", "#productivitytips", "#automation", "#marketinggrowth"],
      reason: "Based on your top 5 highest-saved posts discussing workflows and productivity.",
    },
    {
      id: 2,
      type: "caption",
      title: "Engagement Hook for Short-Form Reel",
      tone: "Curiosity-Driven",
      confidence: 89,
      text: "If you are still posting at 9 AM without checking your audience activity matrix, you are losing 40% of your organic impressions. Here is the data proof:",
      hashtags: ["#socialmediagrowth", "#instagramtips", "#algorithms", "#growthstrategy"],
      reason: "High controversy and data hooks generate 2.8x more comments on your account.",
    },
    {
      id: 3,
      type: "schedule",
      title: "QUBO Schedule Slot: Friday 19:30 UTC",
      tone: "Timing Optimization",
      confidence: 92,
      text: "Optimal window for @"+ activeHandle +". Avoids weekend drop-off while capturing evening engagement peaks.",
      hashtags: ["#peakperformance"],
      reason: "Simulated annealing converged on Friday 19:00-20:30 with zero constraint violations.",
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFeedback = (id: number, action: "accepted" | "rejected") => {
    setFeedback((prev) => ({ ...prev, [id]: action }));
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI Content & Schedule Recommendations (FR-21 to FR-24)
          </h1>
          <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
            Algorithm 2 Engine
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Tailored caption templates, hashtag clusters, and timing recommendations learned from @{activeHandle} post history.
        </p>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {sampleRecommendations.map((rec, idx) => {
          const isDone = feedback[rec.id];

          return (
            <div
              key={rec.id}
              className="bg-white rounded-xl border border-slate-200 p-6 card-hover space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {rec.type}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Confidence: {rec.confidence}%
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{rec.title}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(rec.text + " " + rec.hashtags.join(" "), idx)}
                    className="btn-action text-xs py-1.5 px-3"
                  >
                    {copiedIndex === idx ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check className="w-3.5 h-3.5" /> Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" /> Copy Draft
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Draft Content Card */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed font-sans">
                {rec.text}
              </div>

              {/* Hashtag Set */}
              <div className="flex flex-wrap gap-1.5">
                {rec.hashtags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-200 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Reasoning & Feedback Loop (FR-24) */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">
                  <strong className="text-slate-700">Reasoning:</strong> {rec.reason}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">Helpful recommendation?</span>
                  <button
                    onClick={() => handleFeedback(rec.id, "accepted")}
                    className={`p-1.5 rounded border transition-colors ${
                      isDone === "accepted"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                    title="Accept / Like"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFeedback(rec.id, "rejected")}
                    className={`p-1.5 rounded border transition-colors ${
                      isDone === "rejected"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                    title="Reject / Dislike"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
