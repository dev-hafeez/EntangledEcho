"use client";

import { useState } from "react";
import {
  Sparkles,
  Bell,
  Instagram,
  Facebook,
  ArrowRight,
  LogOut,
  Shield,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Platform } from "@/types";
import { useAccount } from "@/context/AccountContext";
import { useAuth } from "@/context/AuthContext";

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
  const { nicheInfo, isDetectingNiche, isSyncingLatest, syncLatestPosts, lastSyncedAt } = useAccount();
  const { user, role, isAdmin, signOut, updateLinkedHandle } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const clean = inputValue.trim().replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "");
    updateLinkedHandle(clean);
    if (onAnalyzeHandle) {
      onAnalyzeHandle(clean);
    }
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Creator";
  const userInitials = displayName.slice(0, 2).toUpperCase();

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
      <div className="flex items-center gap-3">
        {/* Niche Badge */}
        {nicheInfo?.primary_niche && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-800 rounded-full border border-purple-200 text-xs font-semibold">
            <span>🎯</span>
            <span>{isDetectingNiche ? "Detecting..." : nicheInfo.primary_niche}</span>
          </div>
        )}

        {/* Syncing Badge */}
        {isSyncingLatest ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-medium animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-purple-600" />
            <span>Syncing latest posts...</span>
          </div>
        ) : lastSyncedAt ? (
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-slate-400">
            <span>Synced: {lastSyncedAt}</span>
          </div>
        ) : null}

        {/* Active Account Pill with Manual Sync Button */}
        {activeHandle && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200 text-xs">
            {activePlatform === "facebook" ? (
              <Facebook className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <Instagram className="w-3.5 h-3.5 text-pink-600" />
            )}
            <span className="text-slate-500 capitalize">{activePlatform}:</span>
            <strong className="text-slate-800 font-mono">@{activeHandle}</strong>
            <button
              type="button"
              onClick={() => syncLatestPosts()}
              disabled={isSyncingLatest}
              title="Scrape and sync latest posts from Instagram"
              className="p-1 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingLatest ? "animate-spin text-purple-600" : ""}`} />
            </button>
          </div>
        )}

        {/* Generate Schedule Button */}
        <Link href="/recommendations" className="btn-primary text-xs shadow-sm flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>AI Schedule</span>
        </Link>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs">
              <div className="font-semibold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>System Activity</span>
                <span className="text-[10px] text-emerald-600 font-mono">Live</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="py-2.5 space-y-0.5">
                  <div className="font-medium text-slate-800">Database Cache Sync</div>
                  <div className="text-slate-500">Connected to @{activeHandle || "creator"} profile & posts cache.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar with Dropdown */}
        <div className="relative pl-2 border-l border-slate-200">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100">
              {userInitials}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-none flex items-center gap-1.5">
                <span>{displayName}</span>
                {isAdmin && (
                  <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-800 font-bold rounded">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                {user?.email || "Signed In"}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="font-semibold text-slate-800">{displayName}</div>
                <div className="text-slate-500 text-[11px] truncate">{user?.email}</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 font-mono rounded">
                    Role: {role.toUpperCase()}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-purple-700 hover:bg-purple-50 rounded-lg font-medium transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Command Center</span>
                </Link>
              )}

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Account Settings</span>
              </Link>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
