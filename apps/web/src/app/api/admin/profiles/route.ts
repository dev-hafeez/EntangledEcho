import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
    const res = await fetch(`${aiServiceUrl}/api/v1/profiles/cached`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch cached profiles" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to reach AI service" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, max_posts = 12 } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
    const res = await fetch(`${aiServiceUrl}/api/v1/scrape/instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        max_posts,
        force_refresh: true, // Admin scrape always updates DB cache
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || "Scraping failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Scraping failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json({ error: "Handle query parameter is required" }, { status: 400 });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
    const res = await fetch(`${aiServiceUrl}/api/v1/profiles/${encodeURIComponent(handle)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to delete profile" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Deletion failed" }, { status: 500 });
  }
}
