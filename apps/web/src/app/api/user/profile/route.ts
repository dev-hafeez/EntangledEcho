import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, linked_handle } = body;

    if (!userId || !linked_handle) {
      return NextResponse.json({ error: "userId and linked_handle are required" }, { status: 400 });
    }

    const cleanHandle = linked_handle.trim().lstrip ? linked_handle.trim().replace(/^@/, "") : linked_handle.replace(/^@/, "");

    const { data: userData, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userData.user) {
      return NextResponse.json({ error: fetchErr?.message || "User not found" }, { status: 404 });
    }

    const existingMeta = userData.user.user_metadata || {};
    const updatedMeta = {
      ...existingMeta,
      linked_handle: cleanHandle,
    };

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: updatedMeta,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      linked_handle: cleanHandle,
      user: data.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update profile" }, { status: 500 });
  }
}
