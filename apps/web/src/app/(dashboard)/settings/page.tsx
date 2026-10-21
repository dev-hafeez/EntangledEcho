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
    <div className="space-y-8 max-w-4xl">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Settings & Account Connections (FR-07, FR-08, FR-35)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage linked social channels, security, and notification preferences
        </p>
      </div>

      {/* Connected Accounts Section: Strictly Instagram and Facebook only */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Connected Social Channels</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Integrations supported by Entangled Echo (Instagram Graph API & Facebook Graph API)
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {/* Instagram Account */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                <Instagram className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Instagram Business</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">@{activeHandle}</div>
              </div>
            </div>

            <button className="btn-action text-xs py-1.5 px-3 text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700">
              Disconnect
            </button>
          </div>

          {/* Facebook Page */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <Facebook className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Facebook Page</div>
                <div className="text-xs text-slate-500">Auto-publish cross-promotional posts</div>
              </div>
            </div>

            <button className="btn-action text-xs py-1.5 px-3">
              Connect Page
            </button>
          </div>
        </div>
      </div>

      {/* Notification Preferences (FR-35) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Notification Preferences (FR-35)</h2>
        <div className="space-y-3 divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-semibold text-slate-800">In-App Scheduling Alerts</div>
              <div className="text-xs text-slate-500">Notify 30 minutes before post publishing</div>
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
              <div className="font-semibold text-slate-800">Weekly Email Performance Digest</div>
              <div className="text-xs text-slate-500">Sent every Monday 08:00 in your local timezone</div>
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
              <div className="font-semibold text-slate-800">Milestone & Optimization Alerts</div>
              <div className="text-xs text-slate-500">Notify when reach records or optimal windows are found</div>
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
      <div className="bg-slate-100 rounded-xl p-5 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Shield className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-800 mb-0.5">Token Encryption (AES-256-GCM)</div>
          <p>
            All social media tokens are encrypted at rest using AES-256-GCM and never exposed to the client browser.
          </p>
        </div>
      </div>
    </div>
  );
}
