import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return "Recent";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return typeof dateString === "string" ? dateString : "Recent";
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function extractHandleFromInput(input: string): { handle: string; detectedPlatform: "instagram" | "facebook" } {
  if (!input) return { handle: "", detectedPlatform: "instagram" };
  let clean = input.trim();
  let detectedPlatform: "instagram" | "facebook" = "instagram";
  if (/facebook\.com/i.test(clean)) {
    detectedPlatform = "facebook";
  }
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?facebook\.com\//i, "");
  clean = clean.split("?")[0].split("#")[0].replace(/\/+$/, "").replace(/^@+/, "");
  return { handle: clean.trim(), detectedPlatform };
}

