"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ShieldCheck, UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signUp(email, password, name);
    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-lg shadow-lg">
            E
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Entangled Echo</h1>
            <p className="text-xs text-slate-400">AI Social Intelligence & Scheduling Engine</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-100">Create Creator Account</h2>
          <p className="text-xs text-slate-400 mt-1">
            Join Entangled Echo to unlock quantum-inspired scheduling and AI content analysis.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Rivera"
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Already have an account?</span>
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthProvider>
      <RegisterForm />
    </AuthProvider>
  );
}
