"use client";

import { useState } from "react";
import { useAccount } from "@/context/AccountContext";
import { Instagram, Facebook, Shield, Check, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const { activeHandle } = useAccount();
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [milestones, setMilestones] = useState(true);

  return (
    <div className="space-y-7 max-w-4xl">
      <div className="pb-5 border-b border-slate-200/90">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Settings &amp; Channel Integrations
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage linked social channels, cryptographic token encryption, and automated digest preferences.
        </p>
      </div>

      {/* Connected Accounts Section: Strictly Instagram and Facebook only (Rules compliant) */}
      <div className="card-editorial p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Connected Social Channels</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Supported official integrations (Instagram Graph API &amp; Facebook Graph API).
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {/* Instagram Account */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/70">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Instagram Creator / Business</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">@{activeHandle}</div>
              </div>
            </div>

            <button className="btn-action text-xs py-1.5 px-3">
              Manage
            </button>
          </div>

          {/* Facebook Page */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/70">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Facebook className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Facebook Page</div>
                <div className="text-[11px] text-slate-500">Cross-promotional native scheduling</div>
              </div>
            </div>

            <button className="btn-action text-xs py-1.5 px-3">
              Connect Page
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences (FR-35) */}
      <div className="card-editorial p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Notification Preferences (FR-35)</h2>
        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-semibold text-slate-800">In-App Scheduling Alerts</div>
              <div className="text-[11px] text-slate-500">Notify 30 minutes before post publishing</div>
            </div>
            <input
              type="checkbox"
              checked={inAppAlerts}
              onChange={(e) => setInAppAlerts(e.target.checked)}
              className="w-4 h-4 accent-[#373E3E]"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="font-semibold text-slate-800">Weekly Performance Digest</div>
              <div className="text-[11px] text-slate-500">Sent every Monday 08:00 in your local timezone</div>
            </div>
            <input
              type="checkbox"
              checked={emailDigest}
              onChange={(e) => setEmailDigest(e.target.checked)}
              className="w-4 h-4 accent-[#373E3E]"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="font-semibold text-slate-800">Milestone &amp; Optimization Alerts</div>
              <div className="text-[11px] text-slate-500">Notify when reach records or optimal windows are found</div>
            </div>
            <input
              type="checkbox"
              checked={milestones}
              onChange={(e) => setMilestones(e.target.checked)}
              className="w-4 h-4 accent-[#373E3E]"
            />
          </div>
        </div>
      </div>

      {/* Security & Token Info (FR-08) */}
      <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200/90 text-xs text-slate-600 flex items-start gap-3">
        <Shield className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-900 mb-0.5">Token Encryption (AES-256-GCM)</div>
          <p className="text-[11px] leading-relaxed">
            All social media tokens are encrypted at rest using AES-256-GCM and never exposed to the client browser.
          </p>
        </div>
      </div>
    </div>
  );
}
