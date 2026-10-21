import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const geo = searchParams.get("geo") || "US";
    const limit = searchParams.get("limit") || "12";
    const niche = searchParams.get("niche") || "";

    const url = new URL(`${AI_SERVICE_URL}/api/v1/trends/google`);
    url.searchParams.set("geo", geo);
    url.searchParams.set("limit", limit);
    if (niche) {
      url.searchParams.set("niche", niche);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch Google Trends" },
      { status: 500 }
    );
  }
}
