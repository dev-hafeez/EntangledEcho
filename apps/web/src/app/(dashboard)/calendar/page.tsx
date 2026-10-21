"use client";

import { useState } from "react";
import { useAccount } from "@/context/AccountContext";
import { CalendarDays, Plus, Clock, Sparkles, CheckCircle2 } from "lucide-react";

export default function CalendarPage() {
  const { activeHandle } = useAccount();

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const scheduledEvents = [
    {
      day: "Wednesday",
      time: "18:00 UTC",
      type: "Reel",
      title: "3 Bottlenecks in Content Scaling",
      status: "SCHEDULED",
      isAiRecommended: true,
    },
    {
      day: "Friday",
      time: "19:30 UTC",
      type: "Carousel",
      title: "Quantum Optimization Breakdown",
      status: "SCHEDULED",
      isAiRecommended: true,
    },
    {
      day: "Sunday",
      time: "14:00 UTC",
      type: "Image",
      title: "Weekly Creator Recap & Learnings",
      status: "DRAFT",
      isAiRecommended: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Content Calendar & Auto-Publishing (FR-25, FR-26)
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              Weekly View
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Drag-and-drop schedule with quantum-inspired recommended posting windows for @{activeHandle}
          </p>
        </div>

        <button className="btn-primary text-xs flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Scheduled Post</span>
        </button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const eventsForDay = scheduledEvents.filter((e) => e.day === day);

          return (
            <div
              key={day}
              className="bg-white rounded-xl border border-slate-200 min-h-[380px] p-3 flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 mb-2 flex items-center justify-between">
                  <span>{day.slice(0, 3)}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{day}</span>
                </div>

                <div className="space-y-2">
                  {eventsForDay.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border text-xs bg-slate-50 border-slate-200 space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase bg-black text-white px-1.5 py-0.5 rounded">
                          {ev.type}
                        </span>
                        {ev.isAiRecommended && (
                          <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                            <Sparkles className="w-2.5 h-2.5" /> AI Slot
                          </span>
                        )}
                      </div>
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

              <button className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded border border-dashed border-slate-200 transition-colors mt-2">
                + Add Slot
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
