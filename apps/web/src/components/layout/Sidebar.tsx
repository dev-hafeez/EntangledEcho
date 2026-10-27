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
  Bot,
  UserCheck,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";

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
  const { account, activeHandle } = useAccount();

  const visibleNavItems = baseNavItems.filter((item) => {
    if (item.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#373E3E] text-white flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-black transition-colors">
              E
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-sm block leading-tight">
                Entangled Echo
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                Quantum Content Engine
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-3.5 space-y-1">
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
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 group",
                  isActive
                    ? "bg-[#373E3E] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-800"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.adminOnly ? (
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    Admin
                  </span>
                ) : item.badge ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.2 rounded-full",
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

      {/* Connected Account & User Card */}
      <div className="p-3.5 border-t border-slate-100 space-y-2.5">
        {/* Active Creator Card */}
        {activeHandle && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-2">
              <span className="uppercase tracking-wider text-[10px]">Active Profile</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {account?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={account.avatar_url}
                  alt={activeHandle}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {activeHandle.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-xs truncate">
                  @{activeHandle}
                </div>
                <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                  {formatNumber(account?.follower_count || 0)} followers
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Role Card */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div className="overflow-hidden">
              <div className="text-[11px] font-semibold truncate text-slate-800">
                {user?.email?.split("@")[0] || "Authenticated"}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Role: <span className="text-slate-700 font-semibold">{role.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleAdminRole}
            title="Toggle between Admin and User role"
            className="text-[9px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300/80 font-mono transition-colors"
          >
            Switch
          </button>
        </div>
      </div>
    </aside>
  );
}
