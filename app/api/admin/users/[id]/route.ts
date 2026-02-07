import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { UserService } from "@/lib/services/user";
import { SessionService } from "@/lib/services/session";
import type { Role } from "@/lib/db/schema";

const VALID_ROLES: Role[] = ["user", "moderator", "admin"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(authUser.profile.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be user, moderator, or admin" },
        { status: 400 },
      );
    }

    // Prevent changing own role
    if (userId === authUser.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 },
      );
    }

    const updated = await UserService.updateRole(userId, role);

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Invalidate all sessions for the user when role changes
    await SessionService.invalidateAllUserSessions(userId);

    return NextResponse.json({
      id: userId,
      role: updated.role,
      message: "Role updated. User sessions have been invalidated.",
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(authUser.profile.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: userId } = await params;

    // Prevent deleting self
    if (userId === authUser.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account from admin panel" },
        { status: 400 },
      );
    }

    const success = await UserService.deleteUser(userId);

    if (!success) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
