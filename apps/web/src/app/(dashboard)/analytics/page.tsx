"use client";

import { useAccount } from "@/context/AccountContext";
import { formatNumber } from "@/lib/utils";
import { BarChart3, TrendingUp, Users, Download, ArrowUpRight } from "lucide-react";

export default function AnalyticsPage() {
  const { activeHandle, account, posts } = useAccount();

  // Aggregate stats
  const totalLikes = posts.reduce((acc, p) => acc + (p.latest_metrics?.likes || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.latest_metrics?.comments || 0), 0);
  const totalSaves = posts.reduce((acc, p) => acc + (p.latest_metrics?.saves || 0), 0);
  const totalReach = posts.reduce((acc, p) => acc + (p.latest_metrics?.reach || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Analytics & Engagement Reporting (FR-29, FR-30)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Historical metric trends, audience breakdown, and media type performance for @{activeHandle}
          </p>
        </div>
        <button className="btn-action text-xs flex items-center gap-1.5 self-start sm:self-auto">
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Reach</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalReach)}</div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +14.2% organic growth
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Likes</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalLikes)}</div>
          <div className="text-xs text-slate-500 mt-1">Across {posts.length} posts</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Comments</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalComments)}</div>
          <div className="text-xs text-slate-500 mt-1">High conversation depth</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-hover">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Total Saves</div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(totalSaves)}</div>
          <div className="text-xs text-purple-600 mt-1 font-medium">Algorithmic intent signal</div>
        </div>
      </div>

      {/* Media Type Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900">Content Type Performance Ranking</h2>
          <p className="text-xs text-slate-500">Based on normalized engagement scores across past 90 days</p>
          
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>1. Reels (Short-Form Video)</span>
                <span className="text-emerald-600">Score: 88/100 (+42% Reach)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-[#373E3E] h-2.5 rounded-full" style={{ width: "88%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>2. Multi-Slide Carousels</span>
                <span className="text-blue-600">Score: 74/100 (+26% Saves)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-slate-600 h-2.5 rounded-full" style={{ width: "74%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>3. Static Single Images</span>
                <span className="text-slate-500">Score: 52/100 (Baseline)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-slate-400 h-2.5 rounded-full" style={{ width: "52%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Audience Demographic Preview */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 card-hover space-y-4">
          <h2 className="text-base font-bold text-slate-900">Audience Demographics (FR-30)</h2>
          <p className="text-xs text-slate-500">Age & Gender distribution from Meta Graph API Insights</p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700">Top Age Brackets</span>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between"><span>25-34</span><strong>46%</strong></div>
                <div className="flex justify-between"><span>18-24</span><strong>28%</strong></div>
                <div className="flex justify-between"><span>35-44</span><strong>18%</strong></div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700">Top Geographic Markets</span>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between"><span>United States</span><strong>35%</strong></div>
                <div className="flex justify-between"><span>United Kingdom</span><strong>18%</strong></div>
                <div className="flex justify-between"><span>Pakistan</span><strong>15%</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
