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

export function formatDateTime(dateString: string | Date | undefined | null): { date: string; time: string; full: string } {
  if (!dateString) return { date: "Recent", time: "18:00 UTC", full: "Recent" };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return { date: String(dateString), time: "18:00 UTC", full: String(dateString) };
  }
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time, full: `${date} at ${time}` };
}

export function cleanCaption(rawCaption: string): string {
  if (!rawCaption) return "No caption provided.";
  let clean = rawCaption.replace(/[\u200e\u200f]/g, "").trim();
  clean = clean.replace(/^[^:\n]+ on Instagram(?:\s*:\s*["“]?)?/i, "");
  clean = clean.replace(/["”]?\s*$/, "").trim();
  if (
    !clean ||
    /^[^:\n]+ on Instagram$/i.test(rawCaption.trim()) ||
    /^@[^:\n]+ post on Instagram$/i.test(rawCaption.trim()) ||
    /^May be an image/i.test(clean) ||
    /^May be a graphic/i.test(clean) ||
    /^May be a cartoon/i.test(clean)
  ) {
    return "No caption provided.";
  }
  return clean;
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

