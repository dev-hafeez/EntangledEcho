"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@/context/AccountContext";
import {
  CalendarDays,
  Plus,
  Clock,
  Sparkles,
  CheckCircle2,
  Trash2,
  Atom,
  RefreshCw,
  Video,
  Layers,
  Image as ImageIcon,
  X,
} from "lucide-react";

export default function CalendarPage() {
  const { activeHandle } = useAccount();
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [postCaption, setPostCaption] = useState("");
  const [postTime, setPostTime] = useState("18:00 UTC");
  const [postFormat, setPostFormat] = useState("reel");

  // Quantum AI Recommended Overlay
  const [aiSlots, setAiSlots] = useState<any[]>([]);
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [loadingAiSlots, setLoadingAiSlots] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Load scheduled posts from database
  const loadPosts = async () => {
    if (!activeHandle) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/calendar?handle=${encodeURIComponent(activeHandle)}`);
      const data = await res.json();
      if (data.status === "success") {
        setScheduledPosts(data.scheduled_posts || []);
      }
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Load latest Quantum-Inspired Optimization slots
  const loadQuantumSlots = async () => {
    if (!activeHandle) return;
    setLoadingAiSlots(true);
    try {
      const res = await fetch(`/api/optimize?handle=${encodeURIComponent(activeHandle)}`);
      const data = await res.json();
      if (data.status === "success" && data.job?.primary_schedule?.slots) {
        setAiSlots(data.job.primary_schedule.slots);
      }
    } catch (err) {
      console.error("Failed to load quantum slots:", err);
    } finally {
      setLoadingAiSlots(false);
    }
  };

  useEffect(() => {
    loadPosts();
    loadQuantumSlots();
  }, [activeHandle]);

  // Handle Manual Add Post
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postCaption.trim()) return;

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: activeHandle,
          title: postCaption.slice(0, 40) + "...",
          caption: postCaption,
          media_type: postFormat,
          day_of_week: selectedDay,
          time_slot: postTime,
          scheduled_time: new Date().toISOString(),
          status: "SCHEDULED"
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setPostCaption("");
        setShowAddModal(false);
        loadPosts();
        setStatusMsg("Post slot successfully locked into calendar.");
        setTimeout(() => setStatusMsg(""), 3000);
      }
    } catch (err) {
      console.error("Schedule post failed:", err);
    }
  };

  // Quick Adopt AI Slot
  const handleAdoptAiSlot = async (slot: any) => {
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: activeHandle,
          title: `AI Recommended ${slot.recommended_format}`,
          caption: `Draft for @${activeHandle} (${slot.recommended_format})`,
          media_type: slot.recommended_format.toLowerCase(),
          day_of_week: slot.day_name,
          time_slot: slot.time_utc,
          scheduled_time: new Date().toISOString(),
          status: "SCHEDULED"
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        loadPosts();
        setStatusMsg(`Applied optimal slot (${slot.day_name} at ${slot.time_utc}) to calendar.`);
        setTimeout(() => setStatusMsg(""), 3500);
      }
    } catch (err) {
      console.error("Failed to adopt slot:", err);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    try {
      await fetch(`/api/calendar?id=${encodeURIComponent(postId)}`, {
        method: "DELETE"
      });
      loadPosts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="space-y-7">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Publishing Timeline &amp; Calendar
            </h1>
            <span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 font-mono tabular-nums">
              {scheduledPosts.length} Scheduled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Weekly automated timeline with Quantum-Inspired QUBO slots overlay for @{activeHandle}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAiOverlay(!showAiOverlay)}
            className={`text-xs px-3 py-2 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
              showAiOverlay
                ? "bg-[#373E3E] text-white border-[#373E3E]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span>AI Slots {showAiOverlay ? "Enabled" : "Disabled"}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Manual Schedule Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Schedule Post for @{activeHandle}</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPost} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Day of Week</label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#373E3E]"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Media Format</label>
                  <select
                    value={postFormat}
                    onChange={(e) => setPostFormat(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#373E3E]"
                  >
                    <option value="reel">Reel (Video)</option>
                    <option value="carousel">Carousel</option>
                    <option value="image">Single Image</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Time Slot</label>
                <input
                  type="text"
                  value={postTime}
                  onChange={(e) => setPostTime(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#373E3E] font-mono text-xs"
                  placeholder="e.g. 19:00 UTC"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Post Caption</label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#373E3E] font-sans text-xs"
                  placeholder="Enter caption or draft content..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-action text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-1.5 px-4">
                  Confirm Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Week Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const eventsForDay = scheduledPosts.filter((e) => e.day_of_week === day);
          const aiSlotsForDay = showAiOverlay ? aiSlots.filter((s) => s.day_name === day) : [];

          return (
            <div
              key={day}
              className="card-editorial min-h-[440px] p-3 flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 mb-2 flex items-center justify-between">
                  <span>{day.slice(0, 3)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{day}</span>
                </div>

                <div className="space-y-2">
                  {/* Confirmed Scheduled Posts */}
                  {eventsForDay.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg border text-xs bg-slate-50 border-slate-200 space-y-1.5 shadow-xs relative group"
                    >
                      <button
                        onClick={() => handleDeletePost(ev.id)}
                        className="absolute top-2 right-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete scheduled post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="font-semibold text-slate-800 line-clamp-2 pr-4 text-[11px] leading-tight">
                        {ev.title}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{ev.time_slot || "18:00 UTC"}</span>
                      </div>
                      <div className="text-[9px] font-mono font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ev.status || "SCHEDULED"}</span>
                      </div>
                    </div>
                  ))}

                  {/* AI Recommended Slots (Quantum QUBO Overlay) */}
                  {aiSlotsForDay.map((slot, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-2.5 rounded-lg border border-slate-300 bg-slate-100/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800 bg-slate-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Atom className="w-2.5 h-2.5" /> QUBO Slot
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-700 tabular-nums">
                          {slot.confidence_score}%
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-900">
                        {slot.recommended_format} at {slot.time_utc}
                      </div>
                      <button
                        onClick={() => handleAdoptAiSlot(slot)}
                        className="btn-action w-full text-[10px] py-1 px-2 flex items-center justify-center gap-1 font-semibold"
                      >
                        <Plus className="w-2.5 h-2.5" /> Adopt Slot
                      </button>
                    </div>
                  ))}

                  {eventsForDay.length === 0 && aiSlotsForDay.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg p-2 text-center font-mono">
                      <span>No posts queued</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedDay(day);
                  setShowAddModal(true);
                }}
                className="w-full py-1.5 text-center text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded border border-dashed border-slate-200 transition-colors mt-2 font-mono"
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
