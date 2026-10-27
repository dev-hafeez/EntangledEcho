"use client";

import { useEffect, useState } from "react";
import { Instagram, CheckCircle2, Loader2, Sparkles, Database } from "lucide-react";

interface ProfileLoadingModalProps {
  isOpen: boolean;
  handle: string;
}

export function ProfileLoadingModal({ isOpen, handle }: ProfileLoadingModalProps) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setProgress(15);
      return;
    }

    const timer1 = setTimeout(() => {
      setStep(2);
      setProgress(55);
    }, 700);

    const timer2 = setTimeout(() => {
      setStep(3);
      setProgress(85);
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/90 shadow-2xl rounded-2xl max-w-sm w-full p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Pulsing Icon Halo */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500/20 to-[#373E3E]/20 animate-ping opacity-75" />
          <div className="relative w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md">
            <Instagram className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Title & Handle */}
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block mb-1">
            Data Engine Ingestion
          </span>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Loading @{handle || "creator"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Fetching authentic profile metrics, media posts, and engagement benchmarks.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#373E3E] h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Synchronizing</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Step List */}
        <div className="text-left space-y-2.5 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2.5 text-xs">
            {step >= 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={step >= 1 ? "font-medium text-slate-800" : "text-slate-400"}>
              Querying verified profile headers
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            {step >= 2 ? (
              step === 2 ? (
                <Loader2 className="w-4 h-4 text-[#373E3E] animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={step >= 2 ? "font-medium text-slate-800" : "text-slate-400"}>
              Extracting recent grid posts & metrics
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            {step >= 3 ? (
              <Loader2 className="w-4 h-4 text-[#373E3E] animate-spin shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={step >= 3 ? "font-medium text-slate-800" : "text-slate-400"}>
              Calibrating QUBO scheduler & AI voice
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
