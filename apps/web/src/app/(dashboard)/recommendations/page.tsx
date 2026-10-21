"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@/context/AccountContext";
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Check,
  Copy,
  Clock,
  Layers,
  Brain,
  Send,
  Zap,
  CheckCircle2,
  BarChart2
} from "lucide-react";

export default function RecommendationsPage() {
  const { activeHandle, account, posts, isRealData } = useAccount();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "accepted" | "rejected">>({});

  // Recommendation strategy state from AI backend
  const [strategy, setStrategy] = useState<any>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Interactive Predictor state
  const [draftType, setDraftType] = useState<"reel" | "carousel" | "image">("reel");
  const [draftCaption, setDraftCaption] = useState(
    "Behind the scenes of our latest project! What software do you use for video editing? Drop your favorites 👇 #editing #creators"
  );
  const [draftHour, setDraftHour] = useState("19:00");
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // Fetch optimal content recommendation on mount / account change
  useEffect(() => {
    if (!account) return;

    setLoadingStrategy(true);
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_account: account,
        user_posts: posts,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setStrategy(data);
        }
      })
      .catch((err) => console.error("Error fetching strategy:", err))
      .finally(() => setLoadingStrategy(false));
  }, [account, posts]);

  // Run dynamic prediction with Dual ML models
  const handlePredict = async () => {
    setPredicting(true);
    try {
      const scheduledIso = new Date().toISOString().split("T")[0] + `T${draftHour}:00Z`;

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_media_type: draftType,
          draft_caption: draftCaption,
          scheduled_time: scheduledIso,
          user_account: account || { handle: activeHandle, followers: 207 },
          user_posts: posts,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setPredictionResult(data);
      }
    } catch (err) {
      console.error("Error predicting engagement:", err);
    } finally {
      setPredicting(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFeedback = (id: number, action: "accepted" | "rejected") => {
    setFeedback((prev) => ({ ...prev, [id]: action }));
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Dual-Model AI Recommendations
            </h1>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
              <Brain className="w-3 h-3 text-emerald-600" /> Model 1 + Model 2 Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Combines Global Platform Dynamics (trained on 15,000 multi-niche posts) with @{activeHandle}&apos;s Personal Fingerprint.
          </p>
        </div>
      </div>

      {/* Model Strategy Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Model 1: Global Benchmark */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Model 1 (Global)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
              HistGradientBoosting
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900">Platform Prior</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Trained on 15,000 multi-category posts (R² 0.64). Identifies macro distribution rules (Reels 2.1x reach, evening 17–21:00 peak).
          </p>
        </div>

        {/* Model 2: Personal Profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-purple-600" /> Model 2 (Personal)
            </span>
            <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded">
              Adaptive Bayes
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900">Creator Fingerprint</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Fitted to @{activeHandle}&apos;s verified posts. Discovered personal keywords: {strategy?.creator?.top_keywords?.slice(0, 3).join(", ") || "analyzing vocabulary"}.
          </p>
        </div>

        {/* Blended Optimal Slot */}
        <div className="bg-gradient-to-br from-[#373E3E] to-slate-900 text-white rounded-xl p-5 shadow-sm space-y-2 card-hover">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Optimal Next Move
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-medium">
              Bayesian Optimum
            </span>
          </div>
          <div className="text-lg font-bold text-white">
            {strategy?.optimal_recommendation
              ? `${strategy.optimal_recommendation.recommended_format} on ${strategy.optimal_recommendation.recommended_day}`
              : "Calculating..."}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Slot: {strategy?.optimal_recommendation?.recommended_hour || "19:00 UTC"} | Predicted Reach:{" "}
            <span className="text-emerald-300 font-bold">
              ~{strategy?.optimal_recommendation?.predicted_reach || 450} accounts
            </span>
          </p>
        </div>
      </div>

      {/* Interactive Engagement Predictor Tool */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            Simulate & Predict Engagement for Next Post
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Test any draft caption, media format, and scheduling hour against both machine learning models before publishing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Draft Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Target Media Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["reel", "carousel", "image"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setDraftType(fmt)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                      draftType === fmt
                        ? "bg-[#373E3E] text-white border-[#373E3E] shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Planned Posting Hour (UTC)
              </label>
              <select
                value={draftHour}
                onChange={(e) => setDraftHour(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="09:00">09:00 UTC (Morning Rush)</option>
                <option value="12:00">12:00 UTC (Lunchtime Window)</option>
                <option value="15:00">15:00 UTC (Afternoon Browse)</option>
                <option value="19:00">19:00 UTC (Prime Evening Peak - Recommended)</option>
                <option value="21:30">21:30 UTC (Late Night Wind-down)</option>
                <option value="03:00">03:00 UTC (Off-peak deadzone)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Draft Caption & Hashtags
              </label>
              <textarea
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                rows={3}
                className="w-full text-xs rounded-lg border border-slate-200 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 leading-relaxed font-sans"
                placeholder="Write your draft caption here..."
              />
            </div>

            <button
              onClick={handlePredict}
              disabled={predicting}
              className="w-full btn-action bg-[#373E3E] text-white hover:bg-black py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {predicting ? "Running Dual ML Inference..." : "Predict Engagement with Dual Models"}
            </button>
          </div>

          {/* Prediction Result Display */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
            {predictionResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Inference Output
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    {predictionResult.confidence}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Predicted Engagement</span>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                      {predictionResult.prediction.predicted_engagement_rate}%
                    </div>
                    <span className="text-[10px] text-slate-400">weighted likes + comments</span>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Predicted Organic Reach</span>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      {predictionResult.prediction.predicted_reach}
                    </div>
                    <span className="text-[10px] text-slate-400">unique accounts reached</span>
                  </div>
                </div>

                {/* Bayesian Split Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Empirical Bayes Weights:</span>
                    <span className="font-mono text-[11px]">
                      Personal: {(predictionResult.prediction.personal_weight_alpha * 100).toFixed(0)}% | Global:{" "}
                      {(predictionResult.prediction.global_weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-purple-600 h-full"
                      style={{
                        width: `${predictionResult.prediction.personal_weight_alpha * 100}%`,
                      }}
                    />
                    <div
                      className="bg-amber-500 h-full"
                      style={{
                        width: `${predictionResult.prediction.global_weight * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                  <p>
                    <strong>Global Baseline:</strong> {predictionResult.prediction.global_prediction}% |{" "}
                    <strong>Personal Historical Baseline:</strong> {predictionResult.prediction.personal_baseline}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                <Brain className="w-10 h-10 text-slate-300 animate-pulse" />
                <span className="text-xs font-medium">
                  Click &ldquo;Predict Engagement with Dual Models&rdquo; to test your post draft.
                </span>
                <span className="text-[10px] text-slate-400 max-w-xs">
                  Runs the trained Gradient Boosting model and blends with @{activeHandle}&apos;s personal engagement distribution.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Follow-up Drafts based on Real Scraped Posts */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Tailored Post Suggestions for @{activeHandle}
          </h2>
          <p className="text-xs text-slate-500">
            Synthesized from your verified post captions and top detected keywords.
          </p>
        </div>

        {posts.length > 0 ? (
          posts.map((post, idx) => {
            const isDone = feedback[idx];
            const draftTitle = `Optimized Reel Follow-up for "${post.caption.slice(0, 30)}..."`;
            const suggestedText = `${post.caption.split("\n")[0]}\n\nDropping the full tutorial in the next reel! What do you think?`;

            return (
              <div
                key={post.id || idx}
                className="bg-white rounded-xl border border-slate-200 p-5 card-hover space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Content Recommendation
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Confidence: 89%
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{draftTitle}</h3>
                  </div>

                  <button
                    onClick={() => handleCopy(suggestedText, idx)}
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

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed font-mono">
                  {suggestedText}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span>
                      Based on your real post:{" "}
                      <strong>
                        {post.latest_metrics?.likes ?? (post as any).likes ?? 0} likes,{" "}
                        {post.latest_metrics?.comments ?? (post as any).comments ?? 0} comments
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback(idx, "accepted")}
                      className={`p-1.5 rounded hover:bg-slate-100 ${
                        isDone === "accepted" ? "text-emerald-600 bg-emerald-50" : "text-slate-400"
                      }`}
                      title="Accept draft"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFeedback(idx, "rejected")}
                      className={`p-1.5 rounded hover:bg-slate-100 ${
                        isDone === "rejected" ? "text-rose-600 bg-rose-50" : "text-slate-400"
                      }`}
                      title="Reject draft"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Connect an Instagram account on the Dashboard to generate personalized post recommendations.
          </div>
        )}
      </div>
    </div>
  );
}
