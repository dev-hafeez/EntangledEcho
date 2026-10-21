"use client";

import { useState } from "react";
import { useAccount } from "@/context/AccountContext";
import { CalendarDays, Plus, Clock, Sparkles, CheckCircle2 } from "lucide-react";

export default function CalendarPage() {
  const { activeHandle } = useAccount();
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [postCaption, setPostCaption] = useState("");
  const [postTime, setPostTime] = useState("18:00 UTC");

  const handleAddPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postCaption.trim()) return;
    setScheduledPosts((prev) => [
      ...prev,
      {
        id: Date.now(),
        day: selectedDay,
        time: postTime,
        type: "Post",
        title: postCaption,
        status: "SCHEDULED",
      },
    ]);
    setPostCaption("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Content Calendar & Scheduling
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
              {scheduledPosts.length} Scheduled
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Weekly calendar for planned content releases for @{activeHandle}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Scheduled Post</span>
        </button>
      </div>

      {showAddModal && (
        <div className="p-5 bg-white border border-slate-300 rounded-xl shadow-md max-w-lg space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Schedule Post for @{activeHandle}</h2>
          <form onSubmit={handleAddPost} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Day of Week</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Time</label>
              <input
                type="text"
                value={postTime}
                onChange={(e) => setPostTime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                placeholder="e.g. 19:30 UTC"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Caption</label>
              <textarea
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                rows={3}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                placeholder="Enter caption..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary py-1.5 px-4">
                Confirm Slot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const eventsForDay = scheduledPosts.filter((e) => e.day === day);

          return (
            <div
              key={day}
              className="bg-white rounded-xl border border-slate-200 min-h-[350px] p-3 flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 mb-2 flex items-center justify-between">
                  <span>{day.slice(0, 3)}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{day}</span>
                </div>

                <div className="space-y-2">
                  {eventsForDay.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg border text-xs bg-slate-50 border-slate-200 space-y-1.5 shadow-xs"
                    >
                      <div className="font-semibold text-slate-800 line-clamp-2">{ev.title}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{ev.time}</span>
                      </div>
                      <div className="text-[9px] font-mono font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ev.status}</span>
                      </div>
                    </div>
                  ))}

                  {eventsForDay.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-300 text-xs border border-dashed border-slate-200 rounded-lg p-2 text-center">
                      <span>No posts scheduled</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedDay(day);
                  setShowAddModal(true);
                }}
                className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded border border-dashed border-slate-200 transition-colors mt-2"
              >
                + Add Slot
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
