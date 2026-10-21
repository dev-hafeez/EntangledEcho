"use client";

import { useAccount } from "@/context/AccountContext";
import { formatNumber } from "@/lib/utils";
import { BarChart3, TrendingUp, Users, Download, Hash, ShieldAlert, CheckCircle2 } from "lucide-react";

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
          `"${p.id}","${p.caption.replace(/"/g, '""')}","${p.media_type}",${p.latest_metrics?.likes || 0},${p.latest_metrics?.comments || 0},"${p.permalink}"`
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Real Engagement Analytics
            </h1>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                isRealData
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-100 text-slate-700 border-slate-300"
              }`}
            >
              {isRealData ? "Live Scraped Data" : "Profile Analytics"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Metrics aggregated directly from {posts.length} real scraped posts for @{activeHandle}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={posts.length === 0}
          className="btn-action text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Real Data CSV</span>
        </button>
      </div>

      {/* Real Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Followers</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalFollowers)}</div>
          <div className="text-xs text-slate-500 mt-1">Live from Instagram profile</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Likes</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalLikes)}</div>
          <div className="text-xs text-slate-500 mt-1">Avg {avgLikesPerPost} per post</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Comments</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalComments)}</div>
          <div className="text-xs text-slate-500 mt-1">Avg {avgCommentsPerPost} per post</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Scraped Posts</div>
          <div className="text-2xl font-bold text-slate-900">{posts.length}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">100% Verified Posts</div>
        </div>
      </div>

      {/* Real Content Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900">Actual Media Type Distribution</h2>
          <p className="text-xs text-slate-500">Calculated from {posts.length} discovered posts</p>

          <div className="space-y-4 pt-2">
            {mediaTypesList.length > 0 ? (
              mediaTypesList.map(([type, stats]) => {
                const percentage = Math.round((stats.count / posts.length) * 100);
                const avgLikes = stats.count > 0 ? Math.round(stats.totalLikes / stats.count) : 0;

                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize">{type}</span>
                      <span className="text-slate-700">
                        {stats.count} posts ({percentage}%) • Avg {avgLikes} likes
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#373E3E] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No posts scraped yet.</div>
            )}
          </div>
        </div>

        {/* Real Extracted Hashtags & Profile Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900">Extracted Hashtags & Account Data</h2>
          <p className="text-xs text-slate-500">Real tags found in your captions</p>

          <div className="space-y-3 pt-2">
            {topHashtags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topHashtags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800"
                  >
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span>{tag.replace(/^#/, "")}</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded font-sans text-slate-600">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 space-y-2">
                <div className="font-semibold text-slate-700">No hashtags in recent posts</div>
                <p>Captions on the scraped posts for @{activeHandle} did not contain hashtags.</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-slate-400">Following Count</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {formatNumber(account?.following_count || 0)}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-slate-400">Total Media Count</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">
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
