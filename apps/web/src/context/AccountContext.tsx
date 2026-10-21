"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SocialAccount, Post } from "@/types";
import { extractHandleFromInput, generateRealisticPostsForHandle } from "@/lib/providers/mock";

interface AccountContextType {
  activeHandle: string;
  account: SocialAccount | null;
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  ingestHandleOrUrl: (input: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [activeHandle, setActiveHandle] = useState<string>("entangled_echo");
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const ingestHandleOrUrl = async (input: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const handle = extractHandleFromInput(input);
      // Simulate real ingestion latency (<500ms)
      await new Promise((res) => setTimeout(res, 350));
      const result = generateRealisticPostsForHandle(handle, 24);
      setActiveHandle(handle);
      setAccount(result.account);
      setPosts(result.posts);
    } catch (err: any) {
      setError(err?.message || "Failed to ingest Instagram data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load with default active profile
    ingestHandleOrUrl("entangled_echo");
  }, []);

  return (
    <AccountContext.Provider
      value={{
        activeHandle,
        account,
        posts,
        isLoading,
        error,
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
