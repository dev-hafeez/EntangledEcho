"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Sparkles,
  CalendarDays,
  Bell,
  Settings,
  Shield,
  Instagram,
  Facebook,
  Radio,
  Bot,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: number;
  adminOnly?: boolean;
}

const baseNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Recommendations", href: "/recommendations", icon: Sparkles },
  { name: "AI Strategist", href: "/chat", icon: Bot },
  { name: "Content Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Admin Panel", href: "/admin", icon: Shield, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, isAdmin, toggleAdminRole } = useAuth();

  const visibleNavItems = baseNavItems.filter((item) => {
    if (item.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-[#373E3E] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-black transition-colors">
              E
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">
                Entangled Echo
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                AI & QUBO Optimizer
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[#373E3E] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  item.adminOnly && !isActive ? "text-purple-700 bg-purple-50/50 hover:bg-purple-50" : ""
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-4 h-4", isActive ? "text-white" : item.adminOnly ? "text-purple-600" : "text-slate-500")} />
                  <span>{item.name}</span>
                </div>
                {item.adminOnly ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200/60 text-purple-800 uppercase tracking-wider">
                    Admin
                  </span>
                ) : item.badge ? (
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Connected Accounts & User Role footer */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>Linked Channels</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> Active
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                <span className="font-mono text-[11px]">Instagram</span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Connected</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-mono text-[11px]">Facebook</span>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">Ready</span>
            </div>
          </div>
        </div>

        {/* User Role Card & Admin Toggle */}
        <div className="bg-slate-900 text-white rounded-xl p-2.5 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <UserCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="overflow-hidden">
              <div className="text-[11px] font-semibold truncate text-slate-200">
                {user?.email || "Authenticated"}
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                Role: <span className={isAdmin ? "text-purple-300 font-bold" : "text-slate-300"}>{role.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleAdminRole}
            title="Toggle between Admin and User role for testing"
            className="text-[9px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono transition-colors"
          >
            Switch
          </button>
        </div>
      </div>
    </aside>
  );
}
