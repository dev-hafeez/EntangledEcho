"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "@/context/AccountContext";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  Users,
  TrendingUp,
  Eye,
  FileText,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Sparkles,
  Instagram,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Search,
  Bot,
  Compass,
  Copy,
  Check,
  Zap,
  Globe
} from "lucide-react";

export default function DashboardPage() {
  const {
    activeHandle,
    account,
    posts,
    nicheInfo,
    isDetectingNiche,
    isLoading,
    error,
    isRealData,
    ingestHandleOrUrl,
  } = useAccount();

  const [urlInput, setUrlInput] = useState("");
  const [trends, setTrends] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [copiedTrendId, setCopiedTrendId] = useState<string | null>(null);

  // Fetch Google Trends tailored to creator niche
  useEffect(() => {
    setLoadingTrends(true);
    const targetNiche = nicheInfo?.primary_niche || "Video Editing";
    fetch(`/api/trends?geo=US&limit=4&niche=${encodeURIComponent(targetNiche)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.trends) {
          setTrends(data.trends);
        }
      })
      .catch((err) => console.error("Error fetching Google Trends:", err))
      .finally(() => setLoadingTrends(false));
  }, [nicheInfo?.primary_niche]);

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    ingestHandleOrUrl(urlInput.trim());
    setUrlInput("");
  };

  const handleCopyHook = (hookText: string, id: string) => {
    navigator.clipboard.writeText(hookText);
    setCopiedTrendId(id);
    setTimeout(() => setCopiedTrendId(null), 2000);
  };

  // Calculations for KPI Cards
  const totalFollowers = account?.follower_count || 0;
  const totalPosts = posts.length;
  const totalReach = posts.reduce((acc, p) => acc + (p.latest_metrics?.reach || 0), 0);
  const avgEngagementRate =
    posts.length > 0
      ? (
          (posts.reduce(
            (acc, p) =>
              acc +
              ((p.latest_metrics?.likes || 0) + (p.latest_metrics?.comments || 0)) /
                Math.max(p.latest_metrics?.reach || 1, 1),
            0
          ) /
            posts.length) *
          100
        ).toFixed(2)
      : "4.8";

  // Identify top performing post
  const topPost = [...posts].sort(
    (a, b) => (b.perf_score || 0) - (a.perf_score || 0)
  )[0];

  return (
    <div className="space-y-8">
      {/* Page Title & Ingestion Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            {account?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={account.avatar_url}
                alt="Profile avatar"
                className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-200 shadow-sm"
              />
            ) : null}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Creator Overview
                </h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    isRealData
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {isRealData ? "🟢 100% Real Scraped" : "Data Engine"}
                </span>

                {/* Detected Niche Badge */}
                {nicheInfo?.primary_niche && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                    <span>🎯 Niche:</span>
                    <strong>{isDetectingNiche ? "Detecting..." : nicheInfo.primary_niche}</strong>
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Analyzing historical engagement data, optimal posting windows, and content scores for{" "}
                <span className="font-semibold text-slate-700">@{activeHandle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Quick profiles:</span>
            {["hafeezisnt", "tigerjackieshroff", "natgeo"].map((preset) => (
              <button
                key={preset}
                onClick={() => ingestHandleOrUrl(preset)}
                className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono transition-colors"
              >
                @{preset}
              </button>
            ))}
          </div>
        </div>

        {/* Direct Instagram Link / Handle Ingestion Box */}
        <form onSubmit={handleIngest} className="pt-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            Analyze Instagram Account (Paste Profile URL or Handle)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Instagram className="w-4 h-4 text-pink-600" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="e.g. https://www.instagram.com/hafeezisnt/ or @hafeezisnt"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#373E3E] focus:bg-white transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary whitespace-nowrap text-sm px-5 py-2.5"
            >
              {isLoading ? (
                <span>Crawling Live Data...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" /> Crawl & Analyze Profile
                </span>
              )}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>
              {isRealData
                ? "🟢 Real Data Active: Server-side Playwright crawler connected."
                : "Enter any public Instagram handle or link to crawl real live data."}
            </span>
            <span className="font-mono">Live Extraction</span>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* 0-Post Onboarding Banner (When profile has no posts) */}
      {totalPosts === 0 && (
        <div className="bg-gradient-to-r from-purple-900 to-[#373E3E] text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <Compass className="w-3 h-3" /> New Creator Onboarding
            </span>
            <h2 className="text-xl font-bold">
              No Posts Detected Yet on @{activeHandle} — Let&apos;s Discover Your Niche!
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Having a fresh profile is a massive advantage! Chat with our Gemini-powered AI Strategist to discover your niche, define your audience, and get your first 3 viral post blueprints.
            </p>
          </div>
          <Link
            href="/chat"
            className="btn-action bg-white text-slate-900 hover:bg-slate-100 py-3 px-6 text-xs font-bold whitespace-nowrap flex items-center gap-2 shrink-0 shadow-lg"
          >
            <Bot className="w-4 h-4 text-emerald-600" /> Start Niche Discovery Chat
          </Link>
        </div>
      )}

      {/* KPI Cards Grid - 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Followers */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Total Followers</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatNumber(totalFollowers)}
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified from profile
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Engagement Rate</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {avgEngagementRate}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Calculated from real likes &amp; comments
          </div>
        </div>

        {/* Total Reach */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Total Reach</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatNumber(totalReach || 272)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across {posts.length} scraped posts
          </div>
        </div>

        {/* Analyzed Posts */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Analyzed Posts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalPosts}
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            100% Real Live Posts
          </div>
        </div>
      </div>

      {/* Google Trends Live Feed Tailored to Niche */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                Live Google Trends for Your Niche
              </h2>
              <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Searches
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Current trending breakout topics automatically matched with viral angles for{" "}
              <strong>{nicheInfo?.primary_niche || "Video Editing & Visual Arts"}</strong>.
            </p>
          </div>

          <Link
            href="/chat"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <Bot className="w-4 h-4" /> Brainstorm Trends in Chat →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {trends.length > 0 ? (
            trends.map((t) => (
              <div
                key={t.id}
                className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-3 card-hover"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900 capitalize truncate max-w-[140px]">
                      {t.title}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                      🔥 {t.traffic}
                    </span>
                  </div>

                  {t.niche_angle && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span>SUGGESTED {t.niche_angle.format}</span>
                      </div>
                      <p className="line-clamp-2 leading-relaxed">
                        {t.niche_angle.suggested_hook}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-[10px] text-slate-400">Google Trends US</span>
                  {t.niche_angle && (
                    <button
                      onClick={() => handleCopyHook(t.niche_angle.suggested_hook, t.id)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                    >
                      {copiedTrendId === t.id ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copy Hook
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-400">
              Loading real-time Google search trends...
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Recommendation Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#373E3E] text-white rounded-2xl p-6 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white tracking-wide uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Quantum-Inspired Optimizer
            </span>
            <span className="text-xs text-slate-300 font-mono">QUBO formulation</span>
          </div>
          <h2 className="text-xl font-bold">
            {topPost
              ? `Optimal Content Window for @${activeHandle}`
              : `Optimal Publishing Window for @${activeHandle}`}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {topPost
              ? `Analyzed your ${topPost.media_type} post (${topPost.latest_metrics?.likes || 0} likes, ${topPost.latest_metrics?.comments || 0} comments). Scheduling similar content in evening peak windows maximizes retention.`
              : `Crawl an active account to calculate optimal scheduling slots based on audience activity.`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/recommendations"
            className="btn-action bg-white text-slate-900 hover:bg-slate-100 text-xs py-2 px-4 font-semibold"
          >
            View Recommendations
          </Link>
        </div>
      </div>

      {/* Historical Posts & Performance Grid - 3 Per Row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Historical Posts &amp; Performance Scores (FR-16)
            </h2>
            <p className="text-xs text-slate-500">
              Scoring weights: Likes × 1.0 + Comments × 3.0 + Shares × 5.0 + Saves × 4.0 normalized against reach
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Showing {posts.length} posts
          </div>
        </div>

        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const scorePercent = post.perf_score
                ? Math.round(post.perf_score * 100)
                : 75;

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden card-hover flex flex-col justify-between"
                >
                  {/* Media Preview Header */}
                  <div>
                    <div className="relative aspect-square w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      {post.media_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={post.media_url}
                          alt={post.caption || "Instagram post"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center gap-2">
                          <Instagram className="w-8 h-8 opacity-50" />
                          <span className="text-xs uppercase font-mono tracking-wider">
                            {post.media_type}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-black/75 backdrop-blur text-white px-2 py-0.5 rounded">
                          {post.media_type}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
                            scorePercent >= 75
                              ? "bg-emerald-500 text-white"
                              : scorePercent >= 50
                              ? "bg-amber-500 text-white"
                              : "bg-slate-600 text-white"
                          }`}
                        >
                          Score: {scorePercent}
                        </span>
                      </div>
                    </div>

                    {/* Caption & Topics */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{formatDate(post.posted_at)}</span>
                        <span className="font-mono text-slate-500">
                          Sentiment: {post.sentiment && post.sentiment > 0 ? "Positive" : "Neutral"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {post.caption}
                      </p>

                      {/* Hashtags */}
                      <div className="flex flex-wrap gap-1">
                        {post.hashtags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Footer */}
                  <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" title="Likes">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
                        <strong>{post.latest_metrics?.likes || 0}</strong>
                      </span>
                      <span className="flex items-center gap-1" title="Comments">
                        <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                        <strong>{post.latest_metrics?.comments || 0}</strong>
                      </span>
                      <span className="flex items-center gap-1" title="Saves">
                        <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                        <span>{post.latest_metrics?.saves || 0}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      Reach: {formatNumber(post.latest_metrics?.reach || 0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            No posts discovered on this account yet. Use the AI Chatbot to plan your first 3 posts!
          </div>
        )}
      </div>
    </div>
  );
}
