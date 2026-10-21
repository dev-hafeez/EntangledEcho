"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { Instagram, ArrowRight, ShieldCheck, Database, Sparkles, User, Lock, LogIn } from "lucide-react";
import Link from "next/link";

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, session, role, isAdmin, linkedHandle, updateLinkedHandle, signIn, signUp, isLoading: authLoading } = useAuth();
  const { account, ingestHandleOrUrl, syncLatestPosts, isLoading: accountLoading } = useAccount();

  const [inputVal, setInputVal] = useState("");
  const [cachedProfiles, setCachedProfiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth toggle state for unauthenticated visitors
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Fetch cached profiles from SQLite DB pool to show instant connect options
  useEffect(() => {
    fetch("/api/admin/profiles")
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles && Array.isArray(data.profiles)) {
          setCachedProfiles(data.profiles);
        }
      })
      .catch((err) => console.warn("Failed to load cached profiles:", err));
  }, []);

  // Check if we have an active linked handle
  const hasProfile = Boolean(linkedHandle || account?.handle);

  const handleConnectProfile = async (handleToConnect?: string) => {
    const target = (handleToConnect || inputVal).trim();
    if (!target) {
      setErrorMsg("Please enter your Instagram @handle or profile link.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanHandle = target.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "");
      await updateLinkedHandle(cleanHandle);
      await ingestHandleOrUrl(cleanHandle, "instagram", false);
      // Automatically trigger live scrape in background for the latest posts
      syncLatestPosts(cleanHandle);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to connect profile. Please verify handle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      if (authMode === "login") {
        const res = await signIn(authEmail, authPassword);
        if (res.error) {
          setAuthError(res.error);
        }
      } else {
        const res = await signUp(authEmail, authPassword, authName);
        if (res.error) {
          setAuthError(res.error);
        }
      }
    } catch (e: any) {
      setAuthError(e?.message || "Authentication failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleQuickAdminDemo = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      // Sign in as admin or create admin
      const res = await signIn("admin@entangled.ai", "admin123456");
      if (res.error) {
        // Create demo admin
        const regRes = await signUp("admin@entangled.ai", "admin123456", "Administrator", "admin");
        if (regRes.error) {
          setAuthError(regRes.error);
        }
      }
    } catch (e: any) {
      setAuthError(e?.message || "Demo login failed");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // If initial auth is still loading, show a clean spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-400">Authenticating Entangled Echo...</span>
        </div>
      </div>
    );
  }

  // 1. Mandatory Step A: Must be Authenticated
  if (!user && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg">
              E
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Entangled Echo</h1>
              <p className="text-xs text-slate-400">AI Social Intelligence & Scheduling Engine</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100">
              {authMode === "login" ? "Sign in to your account" : "Create your creator account"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Access your personal AI model, audience insights, and optimal posting times.
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="creator@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {authSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{authMode === "login" ? "Sign In" : "Create Account"}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              {authMode === "login" ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError(null);
              }}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              {authMode === "login" ? "Sign up" : "Log in"}
            </button>
          </div>

          {/* Quick Admin Demo Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleQuickAdminDemo}
              disabled={authSubmitting}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Continue as Admin (Instant 1-Click Access)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Mandatory Step B: Mandatory Profile Gatekeeper
  // "dont let users access anything until they have entered their profile link or @"
  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 text-white relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* User status badge */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                E
              </div>
              <div>
                <span className="font-bold text-white text-base block leading-tight">
                  Entangled Echo
                </span>
                <span className="text-[11px] text-purple-400 font-medium">
                  Mandatory Creator Onboarding
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 bg-slate-800 rounded-full text-slate-300 border border-slate-700 flex items-center gap-1.5 font-mono">
                <User className="w-3 h-3 text-purple-400" />
                <span>{user?.email}</span>
              </span>
              {isAdmin && (
                <span className="text-[10px] px-2 py-0.5 bg-purple-900/60 text-purple-200 border border-purple-700 rounded-full font-bold uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/80 border border-purple-700/60 rounded-full text-purple-300 text-xs font-semibold mb-3">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Step 1: Link Your Creator Profile</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Enter Your Instagram Profile
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              To activate your personal Bayesian ML model, predictive engagement scorer, and custom schedule optimization, please enter your Instagram profile link or handle below.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Form to enter Instagram Profile URL or Handle */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnectProfile();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Instagram Handle or Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-pink-500">
                  <Instagram className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="e.g. @hafeezisnt or https://instagram.com/hafeezisnt"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || accountLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg transition-all flex items-center justify-center gap-2 group"
            >
              {isSubmitting || accountLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Loading & Training Personal Model...</span>
                </>
              ) : (
                <>
                  <span>Connect Profile & Unlock Platform</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Cached Profiles in Database Pool (Instant Connect Option) */}
          {cachedProfiles.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Available in Database Pool (Instant Connect):</span>
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                  ⚡ 0.05s Cache
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {cachedProfiles.map((cp) => (
                  <button
                    key={cp.handle}
                    type="button"
                    onClick={() => handleConnectProfile(cp.handle)}
                    disabled={isSubmitting || accountLoading}
                    className="flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-600/50 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      {cp.avatar_url ? (
                        <img
                          src={cp.avatar_url}
                          alt={cp.handle}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-purple-900/60 text-purple-200 flex items-center justify-center font-bold text-xs">
                          {cp.handle.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-mono font-bold text-slate-200 group-hover:text-purple-300">
                          @{cp.handle}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {cp.followers.toLocaleString()} followers • {cp.post_count || cp.media_count} posts • {cp.niche || "Creator"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-1 bg-purple-900/40 text-purple-300 border border-purple-800 rounded font-medium flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Instant Link</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Admin shortcut if admin user */}
          {isAdmin && (
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Admin Options:</span>
              <Link
                href="/admin"
                className="text-purple-400 hover:text-purple-300 font-semibold underline flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Go to Admin Panel & Scraper Console</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. User is Authenticated AND has Profile linked: Unlock App!
  return <>{children}</>;
}
