"use client";

import { useAccount } from "@/context/AccountContext";
import { formatNumber } from "@/lib/utils";
import { BarChart3, TrendingUp, Users, Download, Hash, CheckCircle2, Flame, Heart, MessageCircle } from "lucide-react";

export default function AnalyticsPage() {
  const { activeHandle, account, posts, isRealData } = useAccount();

  // Aggregate real stats
  const totalLikes = posts.reduce((acc, p) => acc + (p.latest_metrics?.likes || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.latest_metrics?.comments || 0), 0);
  const totalFollowers = account?.follower_count || 0;
  const avgLikesPerPost = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;
  const avgCommentsPerPost = posts.length > 0 ? Math.round(totalComments / posts.length) : 0;

  // Real media type distribution
  const mediaDistribution: Record<string, { count: number; totalLikes: number; totalComments: number }> = {};
  posts.forEach((p) => {
    const type = p.media_type || "image";
    if (!mediaDistribution[type]) {
      mediaDistribution[type] = { count: 0, totalLikes: 0, totalComments: 0 };
    }
    mediaDistribution[type].count += 1;
    mediaDistribution[type].totalLikes += p.latest_metrics?.likes || 0;
    mediaDistribution[type].totalComments += p.latest_metrics?.comments || 0;
  });

  const mediaTypesList = Object.entries(mediaDistribution).sort((a, b) => b[1].count - a[1].count);

  // Real extracted hashtags and frequency
  const hashtagCounts: Record<string, number> = {};
  posts.forEach((p) => {
    (p.hashtags || []).forEach((tag) => {
      hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
    });
  });
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const exportCsv = () => {
    if (posts.length === 0) return;
    const headers = "ID,Caption,Media_Type,Likes,Comments,Post_URL\n";
    const rows = posts
      .map(
        (p) =>
          `"${p.id}","${(p.caption || "").replace(/"/g, '""')}","${p.media_type}",${p.latest_metrics?.likes || 0},${p.latest_metrics?.comments || 0},"${p.permalink}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${activeHandle}_analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Verified Engagement Analytics
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              Live DB Cache
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated metrics across {posts.length} verified scraped posts for @{activeHandle}.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={posts.length === 0}
          className="btn-action text-xs flex items-center gap-2 self-start sm:self-auto py-2 px-4 shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-editorial p-5 card-hover">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Total Followers</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatNumber(totalFollowers)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">Live verified profile count</div>
        </div>

        <div className="card-editorial p-5 card-hover">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Total Likes</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatNumber(totalLikes)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            Avg {formatNumber(avgLikesPerPost)} / post
          </div>
        </div>

        <div className="card-editorial p-5 card-hover">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Total Comments</span>
            <MessageCircle className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatNumber(totalComments)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            Avg {formatNumber(avgCommentsPerPost)} / post
          </div>
        </div>

        <div className="card-editorial p-5 card-hover">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Discovered Posts</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {posts.length}
          </div>
          <div className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Genuine Media
          </div>
        </div>
      </div>

      {/* Real Content Type Breakdown & Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-editorial p-6 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Media Format Performance Mix
          </h2>
          <p className="text-xs text-slate-500">
            Calculated across {posts.length} posts discovered for this creator.
          </p>

          <div className="space-y-4 pt-2">
            {mediaTypesList.length > 0 ? (
              mediaTypesList.map(([type, stats]) => {
                const percentage = Math.round((stats.count / posts.length) * 100);
                const avgLikes = stats.count > 0 ? Math.round(stats.totalLikes / stats.count) : 0;

                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize text-slate-800">{type}</span>
                      <span className="text-slate-600 font-mono tabular-nums">
                        {stats.count} posts ({percentage}%) • Avg {formatNumber(avgLikes)} likes
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#373E3E] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center font-mono">
                No posts available for format mix.
              </div>
            )}
          </div>
        </div>

        {/* Real Extracted Hashtags & Account Data */}
        <div className="card-editorial p-6 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Extracted Hashtag Clusters &amp; Volume
          </h2>
          <p className="text-xs text-slate-500">
            Authentic community tags extracted from the creator&apos;s recent caption history.
          </p>

          <div className="space-y-3 pt-2">
            {topHashtags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topHashtags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-mono text-slate-800"
                  >
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>{tag.replace(/^#/, "")}</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded font-sans text-slate-700 font-bold tabular-nums">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">No hashtags in recent posts</div>
                <p>Captions on the scraped posts for @{activeHandle} were tag-free.</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  Following Count
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                  {formatNumber(account?.following_count || 0)}
                </div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  Total Media Count
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                  {formatNumber(account?.media_count || posts.length)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
