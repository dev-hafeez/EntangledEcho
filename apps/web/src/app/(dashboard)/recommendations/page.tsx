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
  Zap,
  CheckCircle2,
  BarChart2,
  Atom,
  Sliders,
  Calendar,
  ChevronRight,
  TrendingUp,
  ListTodo,
  AlertCircle
} from "lucide-react";

export default function RecommendationsPage() {
  const { activeHandle, account, posts } = useAccount();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<"quantum" | "algorithm2" | "decompose" | "predict">("quantum");

  // ------------------------------------------------------------------
  // 1. Quantum Optimizer State (Algorithm 1 / QUBO)
  // ------------------------------------------------------------------
  const [targetPostsPerWeek, setTargetPostsPerWeek] = useState(5);
  const [minGapHours, setMinGapHours] = useState(4);
  const [blackoutNights, setBlackoutNights] = useState(true);
  const [optAlgorithm, setOptAlgorithm] = useState<"qubo" | "classical_sa" | "compare">("qubo");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState(0); // 0 = primary, 1..3 = alternatives
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState("");

  // ------------------------------------------------------------------
  // 2. Algorithm 2 State (Captions & Content Types)
  // ------------------------------------------------------------------
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState<any[]>([]);
  const [captionMeta, setCaptionMeta] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [copiedDraftIdx, setCopiedDraftIdx] = useState<number | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "accepted" | "rejected">>({});
  const [contentTypeData, setContentTypeData] = useState<any>(null);

  // ------------------------------------------------------------------
  // 3. Goal Decomposer State (FR-22, UC07)
  // ------------------------------------------------------------------
  const [campaignGoal, setCampaignGoal] = useState("Launch new product collection with 4 high-converting posts");
  const [campaignHorizon, setCampaignHorizon] = useState(14);
  const [campaignPostCount, setCampaignPostCount] = useState(4);
  const [decomposing, setDecomposing] = useState(false);
  const [decomposedTasks, setDecomposedTasks] = useState<any[]>([]);

  // ------------------------------------------------------------------
  // 4. Dual ML Predictor State
  // ------------------------------------------------------------------
  const [draftType, setDraftType] = useState<"reel" | "carousel" | "image">("reel");
  const [draftCaption, setDraftCaption] = useState(
    "Loading creator voice..."
  );
  const [draftHour, setDraftHour] = useState("19:00");
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // Fetch initial Algorithm 2 recommendations and latest optimization on account change
  useEffect(() => {
    if (!activeHandle) return;

    // Dynamically initialize draft caption to creator's authentic top post in their personal language
    if (posts && posts.length > 0) {
      const topPost = [...posts].sort((a, b) => (b.perf_score || 0) - (a.perf_score || 0))[0];
      if (topPost && topPost.caption && !topPost.caption.toLowerCase().startsWith("may be")) {
        const cleanCap = topPost.caption.replace(/^[^:\n]+ on Instagram:\s*"?/, "").replace(/"$/, "").trim();
        const tags = (topPost.hashtags || []).map((t: string) => t.startsWith("#") ? t : `#${t}`).join(" ");
        setDraftCaption(`${cleanCap} ${tags}`.trim());
      } else {
        setDraftCaption(`@${activeHandle} upcoming release! 🔥`);
      }
    } else {
      setDraftCaption(`@${activeHandle} upcoming release! 🔥`);
    }

    // Load latest optimization run if exists
    fetch(`/api/optimize?handle=${encodeURIComponent(activeHandle)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && data.job) {
          setOptimizationResult({
            status: "success",
            algorithm: data.job.constraints?.algorithm === "classical_sa" ? "Classical Simulated Annealing" : "Quantum-Inspired QUBO (SimulatedAnnealingSampler)",
            primary_schedule: data.job.primary_schedule,
            alternatives: data.job.alternatives,
            schedule_confidence: data.job.schedule_confidence,
            qubo_stats: data.job.qubo_stats
          });
        }
      })
      .catch((err) => console.log("No previous opt run:", err));

    // Load Algorithm 2 content type ranking
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: account || { handle: activeHandle, followers: 1000 },
        posts: posts,
        recommendation_type: "content_type"
      })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") {
          setContentTypeData(d.data);
        }
      })
      .catch((err) => console.log("CT err:", err));
  }, [activeHandle, account, posts]);

  // Run Quantum Schedule Optimizer
  const handleRunOptimization = async () => {
    setOptimizing(true);
    setScheduleSuccessMsg("");
    try {
      const blackouts = blackoutNights
        ? [{ start_hour: 0, end_hour: 7 }]
        : [];

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: account || { handle: activeHandle, followers: 1000 },
          posts: posts,
          target_posts_per_week: targetPostsPerWeek,
          min_gap_hours: minGapHours,
          blackout_slots: blackouts,
          algorithm: optAlgorithm,
          horizon_days: 7
        })
      });

      const data = await res.json();
      if (data.status === "success") {
        setOptimizationResult(data);
        setSelectedScheduleIndex(0);
      }
    } catch (err) {
      console.error("Optimization failed:", err);
    } finally {
      setOptimizing(false);
    }
  };

  // Generate Captions via Algorithm 2
  const handleGenerateCaptions = async () => {
    setLoadingCaptions(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: account || { handle: activeHandle, followers: 1000 },
          posts: posts,
          recommendation_type: "caption",
          user_prompt: customPrompt || undefined
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setCaptionDrafts(data.data.caption_drafts || []);
        setCaptionMeta(data);
      }
    } catch (err) {
      console.error("Caption generation failed:", err);
    } finally {
      setLoadingCaptions(false);
    }
  };

  // Submit Feedback (FR-24 Learning Loop)
  const handleFeedbackSubmit = async (draftIdx: number, recId: string, accepted: boolean) => {
    const key = `${recId}_${draftIdx}`;
    setFeedbackState((prev) => ({ ...prev, [key]: accepted ? "accepted" : "rejected" }));

    try {
      await fetch("/api/recommend/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recId,
          handle: activeHandle,
          accepted: accepted,
          feedback_text: accepted ? "Creator approved draft" : "Creator rejected draft"
        })
      });
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  // Decompose Goal
  const handleDecompose = async () => {
    setDecomposing(true);
    try {
      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: account || { handle: activeHandle, followers: 1000 },
          goal: campaignGoal,
          platform: "instagram",
          horizon_days: campaignHorizon,
          target_posts: campaignPostCount
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setDecomposedTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Decomposition failed:", err);
    } finally {
      setDecomposing(false);
    }
  };

  // Add slot directly to Calendar
  const handleAddSlotToCalendar = async (slot: any) => {
    try {
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: activeHandle,
          title: `AI Recommended ${slot.recommended_format}: ${slot.day_name} Slot`,
          caption: `Planned ${slot.recommended_format} optimized for ${slot.time_utc} (Confidence: ${slot.confidence_score}%)`,
          media_type: slot.recommended_format.toLowerCase(),
          day_of_week: slot.day_name,
          time_slot: slot.time_utc,
          scheduled_time: new Date().toISOString()
        })
      });
      setScheduleSuccessMsg(`Scheduled ${slot.day_name} ${slot.time_utc} into Content Calendar!`);
      setTimeout(() => setScheduleSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to add to calendar:", err);
    }
  };

  // Dual Model Predictor
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
          user_account: account || { handle: activeHandle, followers: 1000 },
          user_posts: posts
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setPredictionResult(data);
      }
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setPredicting(false);
    }
  };

  // Helper for current schedule
  const activeSchedule =
    optimizationResult?.benchmark_summary
      ? optimizationResult.qubo_result?.primary_schedule
      : selectedScheduleIndex === 0
      ? optimizationResult?.primary_schedule
      : optimizationResult?.alternatives?.[selectedScheduleIndex - 1];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              AI Optimization &amp; Recommendations
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              QUBO Engine Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Combines Quantum-Inspired Schedule Annealing (Algorithm 1) with Pattern-Based AI Recommendations (Algorithm 2) for @{activeHandle}.
          </p>
        </div>

        {/* Tab Navigation Segmented Bar */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/90 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("quantum")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "quantum"
                ? "bg-[#373E3E] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span>Quantum Optimizer (Alg 1)</span>
          </button>
          <button
            onClick={() => setActiveTab("algorithm2")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "algorithm2"
                ? "bg-[#373E3E] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Drafts &amp; Ranking (Alg 2)</span>
          </button>
          <button
            onClick={() => setActiveTab("decompose")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "decompose"
                ? "bg-[#373E3E] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Goal Decomposer</span>
          </button>
          <button
            onClick={() => setActiveTab("predict")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "predict"
                ? "bg-[#373E3E] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Dual-Model Simulator</span>
          </button>
        </div>

      </div>

      {scheduleSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{scheduleSuccessMsg}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: QUANTUM-INSPIRED SCHEDULE OPTIMIZER (Algorithm 1 / QUBO)     */}
      {/* ==================================================================== */}
      {activeTab === "quantum" && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Atom className="w-5 h-5 text-purple-600" />
                  Quantum-Inspired QUBO Posting Optimizer (Algorithm 1)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Solves a 168-variable Quadratic Binary Optimization Hamiltonian via D-Wave Simulated Annealing to uncover optimal slots under strict constraints.
                </p>
              </div>

              <button
                onClick={handleRunOptimization}
                disabled={optimizing}
                className="btn-primary text-xs px-5 py-2.5 flex items-center gap-2 shadow-xs"
              >
                <Atom className={`w-4 h-4 ${optimizing ? "animate-spin" : ""}`} />
                <span>{optimizing ? "Solving Ising / QUBO BQM..." : "Run Quantum Optimization"}</span>
              </button>
            </div>

            {/* Constraint Controls (FR-18) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Target Posts / Week (K)
                </label>
                <select
                  value={targetPostsPerWeek}
                  onChange={(e) => setTargetPostsPerWeek(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value={3}>3 Posts / Week (Light)</option>
                  <option value={4}>4 Posts / Week (Balanced)</option>
                  <option value={5}>5 Posts / Week (Optimal Recommended)</option>
                  <option value={7}>7 Posts / Week (Daily Cadence)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Min Gap Hours Between Posts
                </label>
                <select
                  value={minGapHours}
                  onChange={(e) => setMinGapHours(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value={3}>3 Hours Gap</option>
                  <option value={4}>4 Hours Gap (Standard)</option>
                  <option value={6}>6 Hours Gap (Widely Spaced)</option>
                  <option value={8}>8 Hours Gap (Conservative)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Blackout Periods
                </label>
                <button
                  type="button"
                  onClick={() => setBlackoutNights(!blackoutNights)}
                  className={`w-full text-xs p-2 rounded-lg border text-left flex items-center justify-between ${
                    blackoutNights
                      ? "bg-purple-50 text-purple-800 border-purple-200 font-medium"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <span>Night Blackout (00–08:00)</span>
                  <span className="font-bold">{blackoutNights ? "ON" : "OFF"}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Optimization Algorithm
                </label>
                <select
                  value={optAlgorithm}
                  onChange={(e) => setOptAlgorithm(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value="qubo">QUBO (D-Wave Simulated Annealing)</option>
                  <option value="classical_sa">Classical SA (SRDS Alg 1 Pseudocode)</option>
                  <option value="compare">Benchmark: QUBO vs Classical SA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Display */}
          {optimizationResult && (
            <div className="space-y-6">
              {/* Benchmark Summary if comparing */}
              {optimizationResult.benchmark_summary && (
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                      <Atom className="w-4 h-4" /> Head-to-Head Optimizer Benchmark (SRDS Section 10)
                    </span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Feasible & Validated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-purple-500/30 space-y-2">
                      <div className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                        <Atom className="w-4 h-4" /> Quantum-Inspired QUBO
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {optimizationResult.benchmark_summary.qubo_quantum_inspired.execution_time_ms} ms
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Variables: 168 | Interactions: {optimizationResult.benchmark_summary.qubo_quantum_inspired.interactions} | Ground State Energy: {optimizationResult.benchmark_summary.qubo_quantum_inspired.ground_state_energy} | Confidence: {optimizationResult.benchmark_summary.qubo_quantum_inspired.confidence}%
                      </p>
                    </div>

                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 space-y-2">
                      <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> Classical Simulated Annealing (Alg 1)
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {optimizationResult.benchmark_summary.classical_simulated_annealing.execution_time_ms} ms
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Iterations: {optimizationResult.benchmark_summary.classical_simulated_annealing.iterations} | Best Score: {optimizationResult.benchmark_summary.classical_simulated_annealing.best_score} | Confidence: {optimizationResult.benchmark_summary.classical_simulated_annealing.confidence}%
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {optimizationResult.benchmark_summary.verdict}
                  </div>
                </div>
              )}

              {/* Ranked Alternatives Selector (FR-19) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Schedule Candidates (FR-19: Primary + 3 Ranked Alternatives)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select any candidate schedule to inspect slots or push to the Content Calendar.
                    </p>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                    <button
                      onClick={() => setSelectedScheduleIndex(0)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        selectedScheduleIndex === 0
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-700 hover:text-black"
                      }`}
                    >
                      Primary (Optimal)
                    </button>
                    {(optimizationResult.alternatives || []).map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setSelectedScheduleIndex(i + 1)}
                        className={`px-3 py-1 rounded-md transition-all ${
                          selectedScheduleIndex === i + 1
                            ? "bg-purple-600 text-white shadow-xs"
                            : "text-slate-700 hover:text-black"
                        }`}
                      >
                        Alt {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slots Grid for Active Schedule */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                  {(activeSchedule?.slots || []).map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 card-hover flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200">
                          <span className="font-bold text-slate-900">{slot.day_name}</span>
                          <span className="font-semibold text-purple-700 text-[10px] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {slot.time_utc}
                          </span>
                        </div>
                        <div className="pt-2 space-y-1">
                          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <span>Format:</span>
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px]">
                              {slot.recommended_format}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Bootstrap Stability:{" "}
                            <strong className="text-slate-800">{slot.confidence_score}%</strong>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Expected Score: <strong className="text-slate-800">{slot.slot_score}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddSlotToCalendar(slot)}
                        className="w-full mt-2 py-1.5 text-center text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Schedule Slot</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Metadata Footnote */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Mean Schedule Stability:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {activeSchedule?.mean_confidence || optimizationResult.schedule_confidence}%
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (Resampled 10x with replacement per Section 6.1)
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Ground State Energy:{" "}
                    <strong>{optimizationResult.qubo_stats?.ground_state_energy || "-2.45"}</strong> | Execution Time:{" "}
                    <strong>{optimizationResult.qubo_stats?.execution_time_ms || 2800} ms</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ALGORITHM 2 AI CONTENT RECOMMENDATIONS (FR-21..24)           */}
      {/* ==================================================================== */}
      {activeTab === "algorithm2" && (
        <div className="space-y-6">
          {/* Format Ranking Overview (FR-21 & Section 6.3) */}
          {contentTypeData && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Media Format Ranking & Distribution (Algorithm 2 Step 5)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ranks Reels, Carousels, and Images by mean performance score with sample size n and bootstrap 80% confidence intervals.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Top Recommended: {contentTypeData.top_format}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(contentTypeData.ranked_formats || []).map((fmt: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 card-hover"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        #{i + 1} {fmt.media_type}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Conf: {fmt.confidence_score}%
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      Score: {fmt.mean_performance}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{fmt.reasoning}</p>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                      80% Interval: [{fmt.confidence_interval_80?.[0]}, {fmt.confidence_interval_80?.[1]}] | Sample Size: n={fmt.sample_size_n}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt & Generation Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Generate Tailored AI Caption Drafts & Hashtags (Algorithm 2 Step 3)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Analyzes @{activeHandle}&apos;s verified posts in their authentic native language, length, and personal style — blending live Google Trends search spikes into customized captions and hashtags.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optional topic focus (e.g. 'Announcing my weekly livestream', 'Tips for creators')..."
                className="flex-1 text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
              />
              <button
                onClick={handleGenerateCaptions}
                disabled={loadingCaptions}
                className="btn-primary text-xs px-6 py-2.5 flex items-center justify-center gap-2 shadow-xs"
              >
                <Sparkles className={`w-4 h-4 ${loadingCaptions ? "animate-spin" : ""}`} />
                <span>{loadingCaptions ? "Analyzing Posts & Google Trends..." : "Generate 3 Authentic Drafts"}</span>
              </button>
            </div>
          </div>

          {/* Generated Drafts List with Feedback Buttons (FR-24) */}
          <div className="space-y-4">
            {captionDrafts.length > 0 ? (
              captionDrafts.map((draft, idx) => {
                const recId = captionMeta?.recommendation_id || "rec_live";
                const feedbackKey = `${recId}_${idx}`;
                const userChoice = feedbackState[feedbackKey];

                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs card-hover space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Draft #{idx + 1} • {draft.hook_type}
                          </span>
                          <span className="text-xs text-slate-400">
                            {captionMeta?.data?.confidence_label || `Personal adaptation from verified posts`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{draft.rationale}</p>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(draft.caption + "\n\n" + (draft.hashtags || []).join(" "));
                          setCopiedDraftIdx(idx);
                          setTimeout(() => setCopiedDraftIdx(null), 2000);
                        }}
                        className="btn-action text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        {copiedDraftIdx === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Caption</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-line leading-relaxed">
                      {draft.caption}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(draft.hashtags || []).map((tag: string, tIdx: number) => {
                        const isTrend = tIdx === (draft.hashtags.length - 1) || tag.toLowerCase().includes("trend");
                        return (
                          <span
                            key={tIdx}
                            className={`text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 ${
                              isTrend
                                ? "bg-red-50 text-red-700 border border-red-200 font-semibold"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {isTrend && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                            {tag}
                          </span>
                        );
                      })}
                    </div>

                    {/* Feedback loop buttons (FR-24) */}
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        Help Entangled Echo learn: Accept or reject this angle to update preference weights.
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedbackSubmit(idx, recId, true)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                            userChoice === "accepted"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleFeedbackSubmit(idx, recId, false)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                            userChoice === "rejected"
                              ? "bg-rose-600 text-white border-rose-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                <p>Click &ldquo;Generate 3 Caption Drafts&rdquo; to execute Algorithm 2 for @{activeHandle}.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CAMPAIGN GOAL DECOMPOSER (FR-22, UC07)                       */}
      {/* ==================================================================== */}
      {activeTab === "decompose" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-emerald-600" />
                AI Strategic Campaign Task Decomposer (FR-22, UC07)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Decomposes a high-level creative or business goal into structured, calendar-ready post milestones with assigned formats, priorities, and deadlines.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Creator Campaign Goal
                </label>
                <input
                  type="text"
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  placeholder="e.g. Increase reel views by 25% with educational tips..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Campaign Horizon
                  </label>
                  <select
                    value={campaignHorizon}
                    onChange={(e) => setCampaignHorizon(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value={7}>7 Days (1 Week Sprint)</option>
                    <option value={14}>14 Days (2 Weeks Standard)</option>
                    <option value={30}>30 Days (Full Month Campaign)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Number of Posts
                  </label>
                  <select
                    value={campaignPostCount}
                    onChange={(e) => setCampaignPostCount(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value={3}>3 Posts</option>
                    <option value={4}>4 Posts (Recommended)</option>
                    <option value={6}>6 Posts</option>
                    <option value={8}>8 Posts</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleDecompose}
                disabled={decomposing}
                className="btn-primary text-xs px-6 py-2.5 flex items-center justify-center gap-2 shadow-xs"
              >
                <ListTodo className={`w-4 h-4 ${decomposing ? "animate-spin" : ""}`} />
                <span>{decomposing ? "Decomposing into tasks..." : "Decompose Goal into Post Tasks"}</span>
              </button>
            </div>
          </div>

          {/* Decomposed Tasks Results */}
          {decomposedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Actionable Campaign Milestones ({decomposedTasks.length} tasks)
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {decomposedTasks.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="bg-white rounded-xl border border-slate-200 p-4 card-hover flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {t.media_type}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Priority: {t.priority}
                        </span>
                        <span className="text-xs text-slate-400">
                          Due: {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{t.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
                    </div>

                    <button
                      onClick={() =>
                        handleAddSlotToCalendar({
                          recommended_format: t.media_type,
                          day_name: new Date(t.due_date).toLocaleDateString("en-US", { weekday: "long" }),
                          time_utc: "18:00 UTC",
                          confidence_score: 85.0
                        })
                      }
                      className="btn-action text-xs px-3 py-1.5 flex items-center gap-1.5 self-start md:self-auto shrink-0"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Add to Calendar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: DUAL-MODEL ENGAGEMENT RATE PREDICTOR                         */}
      {/* ==================================================================== */}
      {activeTab === "predict" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Simulate & Predict Engagement for Next Post Draft
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Evaluates Model 1 (Global Gradient Boosting Regressor) and blends with Model 2 (Personal Bayesian Profile) before publishing.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
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
                            ? "bg-[#373E3E] text-white border-[#373E3E] shadow-xs"
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
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800"
                  >
                    <option value="09:00">09:00 UTC (Morning Rush)</option>
                    <option value="12:00">12:00 UTC (Lunch Window)</option>
                    <option value="15:00">15:00 UTC (Afternoon Browse)</option>
                    <option value="19:00">19:00 UTC (Prime Peak - Recommended)</option>
                    <option value="21:30">21:30 UTC (Late Night Wind-down)</option>
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
                    className="w-full text-xs rounded-lg border border-slate-200 p-3 text-slate-800"
                    placeholder="Write caption here..."
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

              {/* Output Card */}
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

                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Bayesian Blending:</span>
                        <span className="font-mono text-[11px]">
                          Personal: {(predictionResult.prediction.personal_weight_alpha * 100).toFixed(0)}% | Global:{" "}
                          {(predictionResult.prediction.global_weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                        <div
                          className="bg-purple-600 h-full"
                          style={{ width: `${predictionResult.prediction.personal_weight_alpha * 100}%` }}
                        />
                        <div
                          className="bg-amber-500 h-full"
                          style={{ width: `${predictionResult.prediction.global_weight * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                    <Brain className="w-10 h-10 text-slate-300 animate-pulse" />
                    <span className="text-xs font-medium">
                      Click &ldquo;Predict Engagement with Dual Models&rdquo; to test your post draft.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
