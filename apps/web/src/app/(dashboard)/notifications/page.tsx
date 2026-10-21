"use client";

import { useState } from "react";
import { Bell, Check, Clock, Sparkles, CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "OPTIMIZER",
      title: "New Optimal Posting Slot Detected",
      message: "Engagement analysis recommends Friday 19:30 UTC for your next Reel (+38% predicted organic reach).",
      timestamp: "10 minutes ago",
      read: false,
    },
    {
      id: 2,
      type: "SYNC",
      title: "Data Normalization Complete",
      message: "Successfully synchronized 24 historical Instagram posts and updated performance scores.",
      timestamp: "2 hours ago",
      read: false,
    },
    {
      id: 3,
      type: "MILESTONE",
      title: "Reach Milestone Achieved",
      message: "Your total 30-day reach surpassed 45,000 unique accounts.",
      timestamp: "1 day ago",
      read: true,
    },
  ]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Notifications (FR-33 to FR-35)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            System alerts, schedule reminders, and performance milestone notices
          </p>
        </div>

        <button onClick={markAllRead} className="btn-action text-xs flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-5 rounded-xl border transition-all ${
              n.read
                ? "bg-white border-slate-200 text-slate-600"
                : "bg-white border-slate-300 shadow-xs border-l-4 border-l-[#373E3E]"
            }`}
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

              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0 mt-2"></span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
