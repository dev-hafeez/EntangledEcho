import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${AI_SERVICE_URL}/api/v1/chat/creator`, {
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
      { error: err.message || "Failed to chat with AI Strategist" },
      { status: 500 }
    );
  }
}
