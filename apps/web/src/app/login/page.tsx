"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

export default function YanshanLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Email format validation helper
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    // Simulate authentication delay for visual demo
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 1200);
  };

  const handleResetDemo = () => {
    setIsSuccess(false);
    setEmail("");
    setPassword("");
    setErrors({});
  };

  return (
    <div
      className="min-h-screen w-full bg-[#F9F8F6] text-[#1A1A1A] flex flex-col lg:grid lg:grid-cols-2 font-sans selection:bg-[#A37B50]/20 selection:text-[#1A1A1A]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* ======================================================== */}
      {/* LEFT COLUMN: Modernist Concrete Architecture Photograph  */}
      {/* ======================================================== */}
      <div className="relative w-full h-64 sm:h-80 lg:h-full min-h-[260px] lg:min-h-screen overflow-hidden bg-[#121212] flex flex-col justify-between p-6 sm:p-10 lg:p-16">
        {/* Architectural Photograph with dramatic grayscale contrast */}
        <img
          src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=2000&q=85"
          alt="Monolithic Modernist Concrete Architecture"
          className="absolute inset-0 w-full h-full object-cover object-center grayscale contrast-125 brightness-75 scale-105 transition-transform duration-1000 ease-out hover:scale-100"
        />

        {/* Subtle Dark Editorial Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/50 pointer-events-none" />

        {/* Top Header on Image */}
        <div className="relative z-10 flex items-center justify-between text-white/70 text-xs tracking-[0.25em] uppercase font-mono">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A37B50]" />
            Studio Workspace
          </span>
          <span className="hidden sm:inline">Monolith Series · Vol. IV</span>
        </div>

        {/* Bottom Hero Branding on Image */}
        <div className="relative z-10 mt-auto pt-8">
          <div className="w-12 h-[1px] bg-[#A37B50] mb-5" />
          <h1
            className="text-white text-3xl sm:text-4xl lg:text-5xl font-normal tracking-[0.18em] uppercase"
            style={{ fontFamily: '"Playfair Display", "Didot", "Bodoni MT", Georgia, serif' }}
          >
            Yanshan
            <span className="block text-white/80 font-light text-2xl sm:text-3xl lg:text-4xl tracking-[0.22em] mt-1">
              Architects
            </span>
          </h1>
          <p className="text-white/60 text-xs sm:text-sm tracking-widest uppercase mt-4 font-light max-w-sm">
            Monolithic form · Spatial silence · Structural precision
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Minimalist Editorial Login Form            */}
      {/* ======================================================== */}
      <div className="w-full flex flex-col justify-between p-6 sm:p-10 lg:p-16 xl:p-24 overflow-y-auto">
        {/* Top Studio Indicator */}
        <div className="flex items-center justify-between text-xs tracking-widest text-[#73716C] uppercase mb-8 sm:mb-12">
          <span>Portal 01</span>
          <span className="font-mono">Est. 2018</span>
        </div>

        {/* Form Container with generous breathing room */}
        <div className="max-w-md w-full mx-auto my-auto py-4">
          {/* Architectural Line-Mark Monogram Logo */}
          <div className="mb-8" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#1A1A1A]"
            >
              {/* Outer structural frame */}
              <rect x="2" y="2" width="32" height="32" stroke="currentColor" strokeWidth="1.25" />
              {/* Orthogonal spatial plane lines */}
              <line x1="2" y1="22" x2="34" y2="22" stroke="#A37B50" strokeWidth="1.25" />
              <line x1="22" y1="2" x2="22" y2="34" stroke="currentColor" strokeWidth="1.25" />
              {/* Bronze focal datum */}
              <rect x="8" y="8" width="6" height="6" fill="#A37B50" />
            </svg>
          </div>

          {/* Editorial Headings */}
          <div className="mb-8">
            <h2
              className="text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight"
              style={{ fontFamily: '"Playfair Display", "Didot", "Bodoni MT", Georgia, serif' }}
            >
              Welcome back
            </h2>
            <p className="text-sm text-[#73716C] mt-2 font-light tracking-wide">
              Sign in to access your studio workspace.
            </p>
          </div>

          {/* Success State Visual Feedback */}
          {isSuccess ? (
            <div className="border border-[#A37B50]/30 bg-[#F4F1EA] p-6 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 text-[#A37B50]">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h3 className="font-medium text-sm tracking-wide uppercase text-[#1A1A1A]">
                  Authentication Verified
                </h3>
              </div>
              <p className="text-xs text-[#73716C] leading-relaxed">
                Welcome to your studio workspace, <span className="font-medium text-[#1A1A1A]">{email}</span>. Spatial files, project drafts, and drawing sheets are ready.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1A1A1A] hover:text-[#A37B50] transition-colors py-2"
                >
                  <span>Sign in as another user</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <label
                  htmlFor="email-address"
                  className="block text-xs font-medium uppercase tracking-wider text-[#4A4844]"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email-address"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="architect@yanshan.com"
                    className={`w-full h-12 min-h-[48px] px-3.5 bg-transparent border text-sm text-[#1A1A1A] placeholder:text-[#A8A59F] outline-none transition-all duration-150 ${
                      errors.email
                        ? "border-[#B23B3B] focus:border-[#B23B3B] focus:ring-1 focus:ring-[#B23B3B]"
                        : "border-[#D6D2C9] hover:border-[#8C8880] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#A37B50]"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-[#B23B3B] mt-1 font-light tracking-wide">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-field"
                    className="block text-xs font-medium uppercase tracking-wider text-[#4A4844]"
                  >
                    Password
                  </label>
                  <a
                    href="#forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Password recovery link sent to your registered studio email.");
                    }}
                    className="text-xs text-[#73716C] hover:text-[#A37B50] transition-colors font-light hover:underline underline-offset-4"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password-field"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="••••••••••••"
                    className={`w-full h-12 min-h-[48px] pl-3.5 pr-12 bg-transparent border text-sm text-[#1A1A1A] placeholder:text-[#A8A59F] outline-none transition-all duration-150 ${
                      errors.password
                        ? "border-[#B23B3B] focus:border-[#B23B3B] focus:ring-1 focus:ring-[#B23B3B]"
                        : "border-[#D6D2C9] hover:border-[#8C8880] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#A37B50]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-0 top-0 h-12 w-12 min-h-[48px] min-w-[48px] flex items-center justify-center text-[#73716C] hover:text-[#1A1A1A] transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 stroke-[1.5]" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[1.5]" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-[#B23B3B] mt-1 font-light tracking-wide">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="pt-1">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none group min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span className="w-4 h-4 border border-[#8C8880] peer-checked:border-[#A37B50] peer-checked:bg-[#A37B50] flex items-center justify-center transition-colors">
                    {rememberMe && (
                      <svg
                        className="w-2.5 h-2.5 text-white stroke-current stroke-2 fill-none"
                        viewBox="0 0 12 12"
                      >
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs text-[#4A4844] group-hover:text-[#1A1A1A] transition-colors font-light">
                    Remember me on this workstation
                  </span>
                </label>
              </div>

              {/* Prominent Sign In Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 min-h-[48px] bg-[#1A1A1A] hover:bg-[#A37B50] active:bg-[#8C653E] text-[#F9F8F6] text-xs font-medium uppercase tracking-[0.2em] transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </div>

              {/* Architectural Studio Note */}
              <div className="pt-4 border-t border-[#E8E5DD] flex items-center justify-between text-[11px] text-[#8C8880]">
                <span>Encrypted Studio Access</span>
                <span className="font-mono">TLS 1.3 / 256-BIT</span>
              </div>
            </form>
          )}
        </div>

        {/* Small Editorial Footer Text */}
        <div className="mt-12 pt-6 border-t border-[#E8E5DD] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#8C8880] tracking-wider uppercase font-light">
          <span>© 2026 Yanshan Architects</span>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-[#1A1A1A] transition-colors">
              Privacy Protocol
            </a>
            <a href="#terms" className="hover:text-[#1A1A1A] transition-colors">
              Terms of Access
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
