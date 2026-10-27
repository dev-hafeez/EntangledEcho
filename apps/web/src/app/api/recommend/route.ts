import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // If recommendation_type is present, route to full Algorithm 2 endpoint
    const endpoint = body.recommendation_type
      ? `${AI_SERVICE_URL}/api/v1/recommend`
      : `${AI_SERVICE_URL}/api/v1/recommend/content`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch recommendation" },
      { status: 500 }
    );
  }
}
