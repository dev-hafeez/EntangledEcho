import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedUsers = (data?.users || []).map((u) => {
      const meta = u.user_metadata || {};
      return {
        id: u.id,
        email: u.email,
        display_name: meta.display_name || u.email?.split("@")[0] || "User",
        role: meta.role || (u.email?.includes("admin") ? "admin" : "user"),
        status: meta.status || "active",
        linked_handle: meta.linked_handle || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
      };
    });

    return NextResponse.json({
      status: "success",
      count: formattedUsers.length,
      users: formattedUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to list users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, display_name, role = "user", linked_handle } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name || email.split("@")[0],
        role: role,
        status: "active",
        linked_handle: linked_handle || null,
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
    return NextResponse.json({ error: err?.message || "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, role, status, linked_handle, display_name } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Fetch existing user to merge metadata
    const { data: userData, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userData.user) {
      return NextResponse.json({ error: fetchErr?.message || "User not found" }, { status: 404 });
    }

    const existingMeta = userData.user.user_metadata || {};
    const updatedMeta = {
      ...existingMeta,
      ...(role !== undefined ? { role } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(linked_handle !== undefined ? { linked_handle } : {}),
      ...(display_name !== undefined ? { display_name } : {}),
    };

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: updatedMeta,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      user: data.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      deletedUserId: userId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete user" }, { status: 500 });
  }
}
