"use client";

import { useState } from "react";
import {
  Sparkles,
  Bell,
  Instagram,
  Facebook,
  ArrowRight,
} from "lucide-react";
import { Platform } from "@/types";

interface TopbarProps {
  onAnalyzeHandle?: (handleOrUrl: string, explicitPlatform?: Platform) => void;
  activeHandle?: string;
  activePlatform?: Platform;
  isAnalyzing?: boolean;
}

export function Topbar({
  onAnalyzeHandle,
  activeHandle = "creator_demo",
  activePlatform = "instagram",
  isAnalyzing = false,
}: TopbarProps) {
  const [inputValue, setInputValue] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    if (onAnalyzeHandle) {
      onAnalyzeHandle(inputValue.trim());
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Instagram & Facebook Quick URL / Handle Analyzer Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-lg w-full">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {activePlatform === "facebook" ? (
              <Facebook className="w-4 h-4 text-blue-600" />
            ) : (
              <Instagram className="w-4 h-4 text-pink-600" />
            )}
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              activePlatform === "facebook"
                ? "Paste Facebook Page link or handle..."
                : "Paste Instagram link or @username..."
            }
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#373E3E] focus:bg-white transition-all font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isAnalyzing}
          className="btn-action whitespace-nowrap text-xs"
        >
          {isAnalyzing ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <span>Load Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Right Action Icons & Profile */}
      <div className="flex items-center gap-4">
        {/* Active Account Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200 text-xs">
          {activePlatform === "facebook" ? (
            <Facebook className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <Instagram className="w-3.5 h-3.5 text-pink-600" />
          )}
          <span className="text-slate-500 capitalize">{activePlatform}:</span>
          <strong className="text-slate-800 font-mono">@{activeHandle}</strong>
        </div>

        {/* Generate Schedule Button */}
        <button className="btn-primary text-xs shadow-sm flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Generate Schedule</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs">
              <div className="font-semibold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Recent Notifications</span>
                <span className="text-[10px] text-slate-400">3 unread</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="py-2.5 space-y-0.5">
                  <div className="font-medium text-slate-800">Optimal Slot Detected</div>
                  <div className="text-slate-500">Peak engagement window today at 19:00 (+38% reach predicted).</div>
                </div>
                <div className="py-2.5 space-y-0.5">
                  <div className="font-medium text-slate-800">Analytics Sync Complete</div>
                  <div className="text-slate-500">24 historical posts normalized and scored.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100">
            AH
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-none">Abdul Hafeez</div>
            <div className="text-[10px] text-slate-400 mt-0.5">FYP Demo</div>
          </div>
        </div>
      </div>
    </header>
  );
}
