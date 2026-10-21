import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, platform } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

    // Call server-side Playwright scraper
    const response = await fetch(`${aiServiceUrl}/api/v1/scrape/instagram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        max_posts: 12,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.detail || "Server-side scraping failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to execute server-side scraper" },
      { status: 500 }
    );
  }
}
