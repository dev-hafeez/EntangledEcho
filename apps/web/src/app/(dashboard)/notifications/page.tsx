"use client";

import { useAccount } from "@/context/AccountContext";
import { formatNumber } from "@/lib/utils";
import { Bell, Check, Clock, CheckCircle2, Instagram, Radio } from "lucide-react";

export default function NotificationsPage() {
  const { activeHandle, account, posts, isRealData } = useAccount();

  // Generate real dynamic notifications based exclusively on live data
  const realNotifications = [];

  if (account) {
    realNotifications.push({
      id: "sync-1",
      type: "LIVE CRAWLER",
      title: `Instagram Profile Loaded (@${activeHandle})`,
      message: `Successfully crawled real profile. Found ${formatNumber(account.follower_count || 0)} followers and ${formatNumber(account.following_count || 0)} following.`,
      timestamp: "Just now",
      read: false,
    });
  }

  if (posts.length > 0) {
    const topPost = posts[0];
    realNotifications.push({
      id: "post-1",
      type: "MEDIA ANALYSIS",
      title: `Scraped Post: ${topPost.media_type.toUpperCase()}`,
      message: `Parsed caption: "${topPost.caption.slice(0, 60)}..." with ${topPost.latest_metrics?.likes || 0} likes and ${topPost.latest_metrics?.comments || 0} comments.`,
      timestamp: "Recent",
      read: false,
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Activity & System Alerts
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
              {realNotifications.length} Events
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real system alerts and scraping events for @{activeHandle}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {realNotifications.length > 0 ? (
          realNotifications.map((n) => (
            <div
              key={n.id}
              className="p-5 rounded-xl border bg-white border-slate-300 shadow-xs border-l-4 border-l-[#373E3E] transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {n.type}
                    </span>
                    <span className="text-xs text-slate-400">{n.timestamp}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2"></span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 bg-white rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700">No Notifications</div>
            <p className="text-xs text-slate-400">
              Paste an Instagram link in the top bar to crawl profile data and generate live alerts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
