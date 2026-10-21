"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
  error: string | null;
  isRealData: boolean;
  setPlatform: (platform: Platform) => void;
  setNicheInfo: (info: any) => void;
  ingestHandleOrUrl: (input: string, explicitPlatform?: Platform) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [activeHandle, setActiveHandle] = useState<string>("hafeezisnt");
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nicheInfo, setNicheInfo] = useState<any>(null);
  const [isDetectingNiche, setIsDetectingNiche] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState<boolean>(false);

  const ingestHandleOrUrl = async (input: string, explicitPlatform?: Platform) => {
    setIsLoading(true);
    setError(null);

    const { handle, detectedPlatform } = extractHandleFromInput(input);
    const targetPlatform = explicitPlatform || detectedPlatform;
    setActiveHandle(handle);
    setActivePlatform(targetPlatform);

    try {
      // 1. Attempt Real Server-Side Scraping via Playwright backend
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle, platform: targetPlatform }),
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

          const formattedPosts: Post[] = data.posts.map((p: any, idx: number) => ({
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

          // Trigger automatic niche detection via Gemini AI
          detectNicheForAccount(realAccount, formattedPosts);

          if (typeof window !== "undefined") {
            try {
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
          // Profile exists but has ZERO posts
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
          detectNicheForAccount(emptyAccount, []);
          return;
        }
      }
    } catch (scrapeErr: any) {
      console.warn("Real scraping attempt fell back:", scrapeErr?.message);
    }

    // Fallback to deterministic normalized data generator if live browser crawler is warming up
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

  useEffect(() => {
    // Initial load: restore from localStorage if available, otherwise crawl
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("ee_account_data");
      const cachedNiche = localStorage.getItem("ee_niche_info");

      if (cachedNiche) {
        try {
          setNicheInfo(JSON.parse(cachedNiche));
        } catch (e) {
          // ignore
        }
      }

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.account) {
            setAccount(parsed.account);
            setPosts(parsed.posts || []);
            setActiveHandle(parsed.activeHandle || "hafeezisnt");
            setIsRealData(parsed.isRealData ?? true);
            setIsLoading(false);
            if (!cachedNiche) {
              detectNicheForAccount(parsed.account, parsed.posts || []);
            }
            return;
          }
        } catch (e) {
          // ignore corrupted cache
        }
      }
    }
    ingestHandleOrUrl("hafeezisnt", "instagram");
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
        error,
        isRealData,
        setPlatform,
        setNicheInfo,
        ingestHandleOrUrl,
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
