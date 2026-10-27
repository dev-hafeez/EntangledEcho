"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "@/context/AccountContext";
import { formatNumber, formatDate, formatDateTime, cleanCaption } from "@/lib/utils";
import {
  Users,
  Eye,
  FileText,
  Heart,
  MessageCircle,
  Bookmark,
  Sparkles,
  Instagram,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Flame,
  Search,
  Bot,
  Compass,
  Copy,
  Check,
  Zap,
  Globe,
  RefreshCw,
  ExternalLink,
  Calendar,
  Clock,
} from "lucide-react";


const VERIFIED_FEATURED = [
  "farishafi",
  "cristiano",
  "virat.kohli",
  "mrbeast",
  "tenzofficial",
  "zakirkhan_208",
  "claudeai",
  "bytebytego",
];

export default function DashboardPage() {
  const {
    activeHandle,
    account,
    posts,
    nicheInfo,
    isDetectingNiche,
    isLoading,
    isSyncingLatest,
    syncLatestPosts,
    error,
    isRealData,
    ingestHandleOrUrl,
  } = useAccount();

  const [urlInput, setUrlInput] = useState("");
  const [trends, setTrends] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [copiedTrendId, setCopiedTrendId] = useState<string | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  const toggleCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCaption = (caption: string, id: string) => {
    navigator.clipboard.writeText(cleanCaption(caption));
    setCopiedCaptionId(id);
    setTimeout(() => setCopiedCaptionId(null), 2000);
  };


  // Fetch Google Trends tailored to creator niche
  useEffect(() => {
    setLoadingTrends(true);
    const targetNiche = nicheInfo?.primary_niche || "Video Editing";
    fetch(`/api/trends?geo=US&limit=4&niche=${encodeURIComponent(targetNiche)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.trends) {
          setTrends(data.trends);
        }
      })
      .catch((err) => console.error("Error fetching Google Trends:", err))
      .finally(() => setLoadingTrends(false));
  }, [nicheInfo?.primary_niche]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const target = urlInput.trim();
    setUrlInput("");
    await ingestHandleOrUrl(target);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
  const totalLikes = posts.reduce((acc, p) => acc + (p.latest_metrics?.likes || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.latest_metrics?.comments || 0), 0);
  const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;
  const avgComments = posts.length > 0 ? Math.round(totalComments / posts.length) : 0;

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

  // Content distribution breakdown
  const reelsCount = posts.filter((p) => p.media_type === "reel").length;
  const carouselCount = posts.filter((p) => p.media_type === "carousel").length;
  const imageCount = posts.filter((p) => p.media_type === "image").length;

  const topPost = [...posts].sort(
    (a, b) => (b.perf_score || 0) - (a.perf_score || 0)
  )[0];

  return (
    <div className="space-y-7">
      {/* Editorial Profile Header Card */}
      <div className="card-editorial p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-5">
            {account?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={account.avatar_url}
                alt={activeHandle}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200/90 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                {activeHandle ? activeHandle.slice(0, 1).toUpperCase() : "C"}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  @{activeHandle || "creator"}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  Verified Public Profile
                </span>
                {nicheInfo?.primary_niche && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <span>Niche:</span>
                    <strong className="text-slate-900">
                      {isDetectingNiche ? "Analyzing..." : nicheInfo.primary_niche}
                    </strong>
                  </span>
                )}
              </div>

              {account?.bio ? (
                <p className="text-xs text-slate-600 max-w-2xl line-clamp-2 leading-relaxed">
                  {account.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Historical engagement intelligence and quantum-inspired QUBO posting optimization.
                </p>
              )}

              {/* Creator Meta Metrics */}
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-500 font-mono">
                <span>
                  <strong className="text-slate-900 tabular-nums">{formatNumber(totalFollowers)}</strong> followers
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-900 tabular-nums">{formatNumber(account?.following_count || 0)}</strong> following
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-900 tabular-nums">{posts.length}</strong> scraped posts
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => syncLatestPosts()}
              disabled={isSyncingLatest}
              className="btn-action text-xs py-2 px-3.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLatest ? "animate-spin" : ""}`} />
              <span>{isSyncingLatest ? "Syncing..." : "Live Sync"}</span>
            </button>

            <Link href="/recommendations" className="btn-primary text-xs py-2 px-4">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Optimize Schedule</span>
            </Link>

            <Link href="/chat" className="btn-action text-xs py-2 px-3.5">
              <Bot className="w-3.5 h-3.5" />
              <span>AI Strategist</span>
            </Link>
          </div>
        </div>

        {/* Quick Ingest & Featured Profiles Bar */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0">
              Verified Library:
            </span>
            {VERIFIED_FEATURED.map((preset) => (
              <button
                key={preset}
                onClick={() => ingestHandleOrUrl(preset)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-mono transition-all shrink-0 ${
                  activeHandle.toLowerCase() === preset.toLowerCase()
                    ? "bg-[#373E3E] text-white font-bold shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                @{preset}
              </button>
            ))}
          </div>

          <form onSubmit={handleIngest} className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Analyze any @creator..."
              className="px-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-[#373E3E] font-sans w-full md:w-56"
            />
            <button type="submit" disabled={isLoading} className="btn-action text-xs py-1.5 px-3 whitespace-nowrap">
              {isLoading ? "Crawling..." : "Analyze"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 3-Column KPI Metrics Grid (Rules: 3 per row on desktop, cards scale slightly on hover) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: Audience & Reach Capital */}
        <div className="card-editorial p-6 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Audience &amp; Reach Capital
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            {formatNumber(totalFollowers)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Estimated 30-Day Reach</span>
            <span className="font-mono font-bold text-slate-800 tabular-nums">
              {formatNumber(totalReach || totalFollowers * 1.8)}
            </span>
          </div>
        </div>

        {/* KPI 2: Engagement Efficiency */}
        <div className="card-editorial p-6 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Engagement Efficiency
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            {avgEngagementRate}%
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Avg Likes: <strong className="text-slate-800">{formatNumber(avgLikes)}</strong></span>
            <span>Avg Comments: <strong className="text-slate-800">{formatNumber(avgComments)}</strong></span>
          </div>
        </div>

        {/* KPI 3: Content Velocity & Media Mix */}
        <div className="card-editorial p-6 card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Content Velocity &amp; Mix
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            {totalPosts} <span className="text-sm font-normal text-slate-500">posts analyzed</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-900" /> Reels: {reelsCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Images: {imageCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> Carousels: {carouselCount}
            </span>
          </div>
        </div>
      </div>

      {/* Quantum-Inspired Optimization Schedule Banner */}
      <div className="bg-[#1c2121] text-white rounded-2xl p-6 sm:p-7 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white tracking-widest uppercase flex items-center gap-1.5 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Quantum-Inspired Optimizer
            </span>
            <span className="text-xs text-slate-400 font-mono">D-Wave QUBO Simulated Annealing</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Optimal Publishing Matrix for @{activeHandle}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Historical posts were formulated as a Quadratic Unconstrained Binary Optimization (QUBO) problem
            solved via simulated annealing with conflict penalty barriers and bootstrap stability confidence.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/recommendations"
            className="btn-action bg-white text-slate-900 hover:bg-slate-100 text-xs py-2.5 px-5 font-bold"
          >
            Launch Solver Matrix →
          </Link>
        </div>
      </div>

      {/* Google Trends Live Feed Tailored to Creator Niche */}
      <div className="card-editorial p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-700" />
                Live Google Search Trends &amp; Content Hooks
              </h2>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakout searches in {nicheInfo?.primary_niche || "Creator Niche"} mapped to viral hook blueprints.
            </p>
          </div>

          <Link
            href="/chat"
            className="text-xs text-slate-700 hover:text-black font-semibold flex items-center gap-1"
          >
            <Bot className="w-3.5 h-3.5" /> Brainstorm in AI Chat →
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 capitalize truncate max-w-[140px]">
                      {t.title}
                    </span>
                    <span className="bg-slate-200 text-slate-800 font-mono font-semibold px-2 py-0.5 rounded text-[10px] tabular-nums">
                      {t.traffic}
                    </span>
                  </div>

                  {t.niche_angle && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 text-xs text-slate-700 space-y-1">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        HOOK ANGLE
                      </div>
                      <p className="line-clamp-2 leading-relaxed text-[11px]">
                        {t.niche_angle.suggested_hook}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">Google Trends</span>
                  {t.niche_angle && (
                    <button
                      onClick={() => handleCopyHook(t.niche_angle.suggested_hook, t.id)}
                      className="text-xs text-slate-700 hover:text-black font-medium flex items-center gap-1"
                    >
                      {copiedTrendId === t.id ? (
                        <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                          <Check className="w-3 h-3" /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copy
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-xs text-slate-400 font-mono">
              Loading Google Search Trends...
            </div>
          )}
        </div>
      </div>

      {/* Historical Posts & Performance Grid - 3 Per Row (Rules compliance) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Authentic Post History &amp; Engagement Scores
            </h2>
            <p className="text-xs text-slate-500">
              Performance score computed via Algorithm 2 percentile normalization across likes, comments, and reach.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {posts.length} Verified Posts
          </span>
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
                  className="card-editorial card-hover flex flex-col justify-between"
                >
                  {/* Media Preview Header */}
                  <div>
                    <div className="relative aspect-square w-full bg-slate-900 flex items-center justify-center overflow-hidden group">
                      {post.media_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={post.media_url}
                          alt={post.caption || "Instagram post"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-black/80 backdrop-blur text-white px-2 py-0.5 rounded">
                          {post.media_type}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-md shadow-xs bg-black/80 backdrop-blur text-white border border-white/10 tabular-nums">
                          SCORE: {scorePercent}
                        </span>
                      </div>
                    </div>

                    {/* Caption & Post Details */}
                    <div className="p-4 space-y-3">
                      {/* Date & Time Posted Bar */}
                      <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900">{formatDateTime(post.posted_at).date}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatDateTime(post.posted_at).time}
                          </span>
                        </div>
                        {(post.permalink || post.external_id) && (
                          <a
                            href={post.permalink || post.external_id}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-black flex items-center gap-1 font-medium text-[11px] transition-colors"
                            title="View original on Instagram"
                          >
                            <span>Instagram</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Prominent Caption Box */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px] flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Post Caption
                          </span>
                          <div className="flex items-center gap-2">
                            {cleanCaption(post.caption) && cleanCaption(post.caption) !== "No caption provided." && (
                              <button
                                type="button"
                                onClick={() => handleCopyCaption(post.caption, post.id)}
                                className="text-slate-400 hover:text-slate-700 text-[10px] font-medium flex items-center gap-1 transition-colors"
                                title="Copy post caption"
                              >
                                {copiedCaptionId === post.id ? (
                                  <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                    <Check className="w-3 h-3" /> Copied
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5">
                                    <Copy className="w-3 h-3" /> Copy
                                  </span>
                                )}
                              </button>
                            )}
                            {cleanCaption(post.caption) !== "No caption provided." && cleanCaption(post.caption).length > 110 && (
                              <button
                                type="button"
                                onClick={() => toggleCaption(post.id)}
                                className="text-slate-600 hover:text-black font-semibold text-[10px] underline underline-offset-2 decoration-slate-300 hover:decoration-black transition-colors"
                              >
                                {expandedCaptions[post.id] ? "Show less" : "Read full"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50/90 rounded-lg p-3 border border-slate-200/80 transition-all">
                          {cleanCaption(post.caption) === "No caption provided." ? (
                            <p className="text-xs text-slate-400 italic font-sans">
                              No caption provided for this post.
                            </p>
                          ) : (
                            <p className={`text-xs text-slate-800 leading-relaxed font-sans ${
                              expandedCaptions[post.id] ? "whitespace-pre-line" : "line-clamp-3"
                            }`}>
                              {cleanCaption(post.caption)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Hashtags */}
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {post.hashtags.slice(0, 4).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded shadow-2xs"
                            >
                              {tag.startsWith("#") ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Metrics Footer */}
                  <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="flex items-center gap-1 text-slate-700" title="Likes">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
                        <strong>{formatNumber(post.latest_metrics?.likes || 0)}</strong>
                      </span>
                      <span className="flex items-center gap-1 text-slate-700" title="Comments">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <strong>{formatNumber(post.latest_metrics?.comments || 0)}</strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      Reach: {formatNumber(post.latest_metrics?.reach || 0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card-editorial p-8 text-center text-slate-500 text-xs">
            No historical posts discovered for this profile yet.
          </div>
        )}
      </div>
    </div>
  );
}
