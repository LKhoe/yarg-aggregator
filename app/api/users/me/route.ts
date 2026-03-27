import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { UserService } from "@/lib/services/user";
import { isValidHttpsUrl, isValidLocale } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userData = await UserService.getById(authUser.id);

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: userData.id,
    email: userData.email,
    name: userData.name,
    emailVerified: userData.emailVerified,
    createdAt: userData.createdAt,
    profile: {
      displayName: userData.profile.displayName,
      avatarUrl: userData.profile.avatarUrl,
      role: userData.profile.role,
      preferredLanguage: userData.profile.preferredLanguage,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName, avatarUrl, preferredLanguage } = body;

    // Validate avatarUrl if provided
    if (avatarUrl !== undefined && avatarUrl !== null) {
      if (!isValidHttpsUrl(avatarUrl)) {
        return NextResponse.json(
          { error: "avatarUrl must be a valid HTTPS URL" },
          { status: 400 },
        );
      }
    }

    // Validate preferredLanguage if provided
    if (preferredLanguage !== undefined && preferredLanguage !== null) {
      if (!isValidLocale(preferredLanguage)) {
        return NextResponse.json(
          { error: "Invalid language" },
          { status: 400 },
        );
      }
    }

    // Validate displayName if provided
    if (displayName !== undefined) {
      if (
        typeof displayName !== "string" ||
        displayName.length < 2 ||
        displayName.length > 30
      ) {
        return NextResponse.json(
          { error: "Display name must be between 2 and 30 characters" },
          { status: 400 },
        );
      }

      // Only allow alphanumeric, underscores, and hyphens
      if (!/^[a-zA-Z0-9_-]+$/.test(displayName)) {
        return NextResponse.json(
          {
            error:
              "Display name can only contain letters, numbers, underscores, and hyphens",
          },
          { status: 400 },
        );
      }
    }

    const updated = await UserService.updateProfile(authUser.id, {
      displayName,
      avatarUrl,
      preferredLanguage,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      preferredLanguage: updated.preferredLanguage,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Display name already taken"
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await UserService.deleteUser(authUser.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
