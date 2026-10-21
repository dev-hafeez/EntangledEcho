"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { SocialAccount, Post, Platform } from "@/types";
import { extractHandleFromInput, generateRealisticPostsForHandle } from "@/lib/providers/mock";

interface AccountContextType {
  activeHandle: string;
  activePlatform: Platform;
  account: SocialAccount | null;
  posts: Post[];
  nicheInfo: any;
  isDetectingNiche: boolean;
  isLoading: boolean;
  isSyncingLatest: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  isRealData: boolean;
  setPlatform: (platform: Platform) => void;
  setNicheInfo: (info: any) => void;
  ingestHandleOrUrl: (input: string, explicitPlatform?: Platform, forceRefresh?: boolean) => Promise<void>;
  syncLatestPosts: (targetHandle?: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [activeHandle, setActiveHandle] = useState<string>("");
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nicheInfo, setNicheInfo] = useState<any>(null);
  const [isDetectingNiche, setIsDetectingNiche] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncingLatest, setIsSyncingLatest] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState<boolean>(false);

  const hasAutoSyncedRef = useRef<boolean>(false);

  const ingestHandleOrUrl = async (
    input: string,
    explicitPlatform?: Platform,
    forceRefresh: boolean = false
  ) => {
    // Only show full loading blocker if we have no existing account in view
    if (!account) {
      setIsLoading(true);
    } else if (forceRefresh) {
      setIsSyncingLatest(true);
    }
    setError(null);

    const { handle, detectedPlatform } = extractHandleFromInput(input);
    const targetPlatform = explicitPlatform || detectedPlatform;
    setActiveHandle(handle);
    setActivePlatform(targetPlatform);

    try {
      // 1. Server-Side Scraper via Playwright & Database Cache
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: handle,
          platform: targetPlatform,
          force_refresh: forceRefresh,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.posts && data.posts.length > 0) {
          const accInfo = data.account || {};
          const realAccount: SocialAccount = {
            id: `acc_real_${handle}`,
            user_id: "demo-user-1",
            platform: targetPlatform,
            external_id: `real_${handle}`,
            handle: handle,
            avatar_url: accInfo.avatar_url,
            follower_count: accInfo.followers || 0,
            following_count: accInfo.following || 0,
            media_count: accInfo.media_count || data.posts.length,
            last_sync: new Date().toISOString(),
            status: "active",
            is_synthetic: false,
          };

          // Safeguard: Deduplicate by post_url
          const seenUrls = new Set<string>();
          const distinctPosts = data.posts.filter((p: any) => {
            const norm = (p.post_url || p.id || "").split("?")[0].replace(/\/$/, "");
            if (!norm || seenUrls.has(norm)) return false;
            seenUrls.add(norm);
            return true;
          });

          const formattedPosts: Post[] = distinctPosts.map((p: any, idx: number) => ({
            id: p.id || `post_${handle}_${idx}`,
            account_id: realAccount.id,
            external_id: p.post_url,
            caption: p.caption || "No caption",
            hashtags: p.hashtags || [],
            media_type: p.media_type || "image",
            media_url: p.media_url,
            permalink: p.post_url,
            posted_at: p.posted_at || new Date().toISOString(),
            perf_score: p.perf_score || 0.75,
            topics: p.topics || ["Live Scrape"],
            sentiment: p.sentiment || 0.4,
            latest_metrics: {
              id: `metric_${p.id || idx}`,
              post_id: p.id || `post_${handle}_${idx}`,
              likes: p.likes || 0,
              comments: p.comments || 0,
              shares: Math.floor((p.likes || 10) * 0.15),
              saves: Math.floor((p.likes || 10) * 0.2),
              reach: p.reach || 1000,
              views: p.reach ? Math.floor(p.reach * 1.2) : 1200,
              impressions: p.reach ? Math.floor(p.reach * 1.4) : 1400,
              collected_at: new Date().toISOString(),
            },
          }));

          setAccount(realAccount);
          setPosts(formattedPosts);
          setIsRealData(true);
          setIsLoading(false);
          setIsSyncingLatest(false);
          setLastSyncedAt(new Date().toLocaleTimeString());

          // Trigger automatic niche detection via Gemini AI if new
          if (accInfo.niche_info) {
            setNicheInfo(accInfo.niche_info);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("ee_niche_info", JSON.stringify(accInfo.niche_info));
              } catch (e) {}
            }
          } else {
            detectNicheForAccount(realAccount, formattedPosts);
          }

          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("ee_linked_handle", handle);
              localStorage.setItem(
                "ee_account_data",
                JSON.stringify({
                  account: realAccount,
                  posts: formattedPosts,
                  activeHandle: handle,
                  isRealData: true,
                })
              );
            } catch (storageErr) {
              console.warn("Storage error:", storageErr);
            }
          }
          return;
        } else {
          // Profile exists but has 0 posts
          const emptyAccount: SocialAccount = {
            id: `acc_real_${handle}`,
            user_id: "demo-user-1",
            platform: targetPlatform,
            external_id: `real_${handle}`,
            handle: handle,
            avatar_url: data.account?.avatar_url,
            follower_count: data.account?.followers || 0,
            following_count: data.account?.following || 0,
            media_count: 0,
            last_sync: new Date().toISOString(),
            status: "active",
            is_synthetic: false,
          };
          setAccount(emptyAccount);
          setPosts([]);
          setIsRealData(true);
          setIsLoading(false);
          setIsSyncingLatest(false);
          setLastSyncedAt(new Date().toLocaleTimeString());
          if (data.account?.niche_info) {
            setNicheInfo(data.account.niche_info);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("ee_niche_info", JSON.stringify(data.account.niche_info));
              } catch (e) {}
            }
          } else {
            detectNicheForAccount(emptyAccount, []);
          }
          return;
        }
      }
    } catch (scrapeErr: any) {
      console.warn("Real scraping attempt fell back:", scrapeErr?.message);
    } finally {
      setIsLoading(false);
      setIsSyncingLatest(false);
    }

    // Fallback only if crawler is unavailable
    try {
      const result = generateRealisticPostsForHandle(handle, targetPlatform, 24);
      setAccount(result.account);
      setPosts(result.posts);
      setIsRealData(false);
      detectNicheForAccount(result.account, result.posts);
    } catch (err: any) {
      setError(err?.message || "Failed to load account data");
    } finally {
      setIsLoading(false);
      setIsSyncingLatest(false);
    }
  };

  /**
   * Scrapes the user's connected Instagram profile for the very latest posts
   * Updates database cache and refreshes state in real-time.
   */
  const syncLatestPosts = async (targetHandle?: string) => {
    const handleToSync = targetHandle || activeHandle;
    if (!handleToSync) return;

    setIsSyncingLatest(true);
    try {
      await ingestHandleOrUrl(handleToSync, activePlatform, true);
    } catch (e) {
      console.warn("Failed to sync latest posts:", e);
    } finally {
      setIsSyncingLatest(false);
    }
  };

  const detectNicheForAccount = async (acc: SocialAccount, postList: Post[]) => {
    setIsDetectingNiche(true);
    try {
      const res = await fetch("/api/niche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: acc, posts: postList }),
      });
      if (res.ok) {
        const data = await res.json();
        setNicheInfo(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("ee_niche_info", JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn("Failed to detect niche:", e);
    } finally {
      setIsDetectingNiche(false);
    }
  };

  const setPlatform = (platform: Platform) => {
    setActivePlatform(platform);
    ingestHandleOrUrl(activeHandle, platform);
  };

  // On Login / Mount:
  // 1. Immediately display cached profile & posts from DB/localStorage (instant 0.05s response)
  // 2. Automatically scrape Instagram for the connected profile to fetch latest posts!
  useEffect(() => {
    let savedHandle: string | null = null;

    if (typeof window !== "undefined") {
      savedHandle = localStorage.getItem("ee_linked_handle");
      const cached = localStorage.getItem("ee_account_data");
      const cachedNiche = localStorage.getItem("ee_niche_info");

      if (cachedNiche) {
        try {
          const parsed = JSON.parse(cachedNiche);
          if (!savedHandle || !parsed.handle || parsed.handle.toLowerCase() === savedHandle.toLowerCase()) {
            setNicheInfo(parsed);
          }
        } catch (e) {
          // ignore
        }
      }

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.account && parsed.account.handle) {
            setAccount(parsed.account);
            setPosts(parsed.posts || []);
            setActiveHandle(parsed.account.handle);
            setIsRealData(parsed.isRealData ?? true);
            setIsLoading(false);
            savedHandle = parsed.account.handle;
          }
        } catch (e) {
          // ignore corrupted cache
        }
      }
    }

    if (savedHandle) {
      setActiveHandle(savedHandle);

      // If we don't have posts loaded yet, load them from cache first
      if (!account) {
        ingestHandleOrUrl(savedHandle, "instagram", false);
      }

      // Automatically scrape Instagram for latest posts on login!
      if (!hasAutoSyncedRef.current) {
        hasAutoSyncedRef.current = true;
        // Trigger live refresh in background to fetch latest posts
        syncLatestPosts(savedHandle);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AccountContext.Provider
      value={{
        activeHandle,
        activePlatform,
        account,
        posts,
        nicheInfo,
        isDetectingNiche,
        isLoading,
        isSyncingLatest,
        lastSyncedAt,
        error,
        isRealData,
        setPlatform,
        setNicheInfo,
        ingestHandleOrUrl,
        syncLatestPosts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
