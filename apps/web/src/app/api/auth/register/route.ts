import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, display_name, role = "user" } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const isUserAdmin =
      role === "admin" ||
      email.toLowerCase().includes("admin") ||
      email.toLowerCase() === "hafeez@admin.com";

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so user can sign in immediately!
      user_metadata: {
        display_name: display_name || email.split("@")[0],
        role: isUserAdmin ? "admin" : "user",
        status: "active",
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      user: data.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Registration failed" }, { status: 500 });
  }
}
