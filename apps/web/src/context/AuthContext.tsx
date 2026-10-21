"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isAdmin: boolean;
  isSuspended: boolean;
  linkedHandle: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string, role?: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateLinkedHandle: (handle: string) => Promise<void>;
  toggleAdminRole: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [linkedHandle, setLinkedHandleState] = useState<string | null>(null);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync state from Supabase user object
  const processUserData = (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      setRole("user");
      setLinkedHandleState(null);
      setIsSuspended(false);
      return;
    }

    setUser(currentUser);
    const meta = currentUser.user_metadata || {};

    // Check if user has admin role
    const isUserAdmin =
      meta.role === "admin" ||
      currentUser.email?.toLowerCase().includes("admin") ||
      currentUser.email?.toLowerCase() === "hafeez@admin.com";

    const userRole: UserRole = isUserAdmin ? "admin" : (meta.role || "user");
    setRole(userRole);

    const suspended = meta.status === "suspended";
    setIsSuspended(suspended);

    // Linked Instagram Profile Handle
    const handle = meta.linked_handle || (typeof window !== "undefined" ? localStorage.getItem("ee_linked_handle") : null);
    if (handle) {
      setLinkedHandleState(handle);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check existing active session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) {
        setSession(initialSession);
        processUserData(initialSession?.user ?? null);
        setIsLoading(false);
      }
    });

    // Listen to real-time auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        processUserData(currentSession?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      setSession(data.session);
      processUserData(data.user);
      setIsLoading(false);
      return { error: null };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Sign in failed" };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    initialRole: UserRole = "user"
  ): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          role: initialRole,
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        setIsLoading(false);
        return { error: regData.error || "Registration failed" };
      }

      // Automatically sign in with the new confirmed account
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      setSession(data.session);
      processUserData(data.user);
      setIsLoading(false);
      return { error: null };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Sign up failed" };
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    } finally {
      setUser(null);
      setSession(null);
      setRole("user");
      setLinkedHandleState(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ee_linked_handle");
      }
      setIsLoading(false);
    }
  };

  const updateLinkedHandle = async (handle: string) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    setLinkedHandleState(clean);
    if (typeof window !== "undefined") {
      localStorage.setItem("ee_linked_handle", clean);
    }

    // Persist to user_metadata on backend if authenticated
    if (user?.id) {
      try {
        await fetch("/api/user/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            linked_handle: clean,
          }),
        });
      } catch (e) {
        console.warn("Failed to persist handle to backend:", e);
      }
    }
  };

  const toggleAdminRole = () => {
    const nextRole: UserRole = role === "admin" ? "user" : "admin";
    setRole(nextRole);
    if (user?.id) {
      fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
        }),
      }).catch(console.warn);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isAdmin: role === "admin",
        isSuspended,
        linkedHandle,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateLinkedHandle,
        toggleAdminRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
