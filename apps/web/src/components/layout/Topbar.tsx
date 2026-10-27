"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bell,
  Instagram,
  Facebook,
  Search,
  ArrowRight,
  LogOut,
  Shield,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Platform } from "@/types";
import { useAccount } from "@/context/AccountContext";
import { useAuth } from "@/context/AuthContext";
import { formatNumber } from "@/lib/utils";

interface TopbarProps {
  onAnalyzeHandle?: (handleOrUrl: string, explicitPlatform?: Platform) => void;
  activeHandle?: string;
  activePlatform?: Platform;
  isAnalyzing?: boolean;
}

export function Topbar({
  onAnalyzeHandle,
  activeHandle = "hafeezisnt",
  activePlatform = "instagram",
  isAnalyzing = false,
}: TopbarProps) {
  const { account, nicheInfo, isDetectingNiche, isSyncingLatest, syncLatestPosts, lastSyncedAt } = useAccount();
  const { user, role, isAdmin, signOut, updateLinkedHandle } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [cachedProfiles, setCachedProfiles] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch cached profiles for instant search suggestions
  useEffect(() => {
    fetch("/api/admin/profiles")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.profiles) {
          setCachedProfiles(data.profiles);
        }
      })
      .catch(() => {});
  }, []);

  // Handle outside click for search suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProfile = (handle: string) => {
    setInputValue("");
    setIsFocused(false);
    updateLinkedHandle(handle);
    if (onAnalyzeHandle) {
      onAnalyzeHandle(handle);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const clean = inputValue
      .trim()
      .replace(/^@/, "")
      .replace(/.*instagram\.com\//, "")
      .replace(/\/$/, "");
    setIsFocused(false);
    updateLinkedHandle(clean);
    if (onAnalyzeHandle) {
      onAnalyzeHandle(clean);
    }
    setInputValue("");
  };

  const filteredSuggestions = inputValue.trim()
    ? cachedProfiles.filter((p) =>
        p.handle?.toLowerCase().includes(inputValue.toLowerCase())
      ).slice(0, 6)
    : cachedProfiles.slice(0, 6);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Creator";
  const userInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="h-16 header-glass border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-30 transition-all">
      {/* Search & Profile Ingestion Bar with Autocomplete */}
      <div ref={searchContainerRef} className="relative max-w-md w-full">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={inputValue}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search or enter @creator handle..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-[#373E3E] transition-all font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing}
            className="btn-action whitespace-nowrap text-xs py-1.5 px-3"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Loading...</span>
              </span>
            ) : (
              <span>Load</span>
            )}
          </button>
        </form>

        {/* Live Search Autocomplete Dropdown */}
        {isFocused && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <span>{inputValue.trim() ? "Search Results" : "Verified Creator Library"}</span>
              <span className="font-mono text-[10px] text-slate-400">{cachedProfiles.length} loaded</span>
            </div>

            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((prof) => (
                  <button
                    key={prof.handle}
                    type="button"
                    onClick={() => handleSelectProfile(prof.handle)}
                    className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prof.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={prof.avatar_url}
                          alt={prof.handle}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                          {prof.handle.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 group-hover:text-black block leading-tight">
                          @{prof.handle}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {prof.niche || "Creator"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-mono text-[11px] font-semibold text-slate-700 block tabular-nums">
                        {formatNumber(prof.followers || 0)}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-tight">followers</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500">
                  <p className="text-xs">No cached profile found for &quot;{inputValue}&quot;.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Press Enter to crawl and ingest this profile live.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Active Profile Tag, Optimization CTA, Bell, Avatar */}
      <div className="flex items-center gap-3">
        {/* Niche Indicator Badge */}
        {nicheInfo?.primary_niche && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-md border border-slate-200/80 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span>{isDetectingNiche ? "Analyzing..." : nicheInfo.primary_niche}</span>
          </div>
        )}

        {/* Active Account Pill with Sync Button */}
        {activeHandle && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white rounded-md border border-slate-200 text-xs shadow-xs">
            <Instagram className="w-3.5 h-3.5 text-slate-700" />
            <span className="font-semibold text-slate-900">@{activeHandle}</span>
            <button
              type="button"
              onClick={() => syncLatestPosts()}
              disabled={isSyncingLatest}
              title="Sync latest metrics from Instagram"
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingLatest ? "animate-spin text-slate-800" : ""}`} />
            </button>
          </div>
        )}

        {/* AI Recommendations Button */}
        <Link href="/recommendations" className="btn-primary text-xs shadow-xs flex items-center gap-1.5 py-1.5 px-3">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>QUBO Optimizer</span>
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs animate-in fade-in duration-150">
              <div className="font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>System Status</span>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">ONLINE</span>
              </div>
              <div className="py-2.5 text-slate-600 text-xs">
                Active live crawler & D-Wave QUBO engine ready. Connected to @{activeHandle}.
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative pl-2 border-l border-slate-200">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:opacity-85 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-[#373E3E] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {userInitials}
            </div>
            <span className="hidden md:block text-xs font-semibold text-slate-800">
              {displayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 text-xs animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="font-semibold text-slate-900">{displayName}</div>
                <div className="text-slate-500 text-[11px] truncate">{user?.email}</div>
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-600" />
                  <span>Admin Panel</span>
                </Link>
              )}

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
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
