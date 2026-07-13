import { NextRequest, NextResponse } from "next/server";
import { APIError } from "better-auth";
import { auth } from "@/lib/auth";
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

  let password: string | undefined;
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    // No JSON body provided — falls back to the session-freshness check below.
  }

  try {
    const { headers, response } = await auth.api.deleteUser({
      headers: request.headers,
      body: { password },
      returnHeaders: true,
    });

    const res = NextResponse.json(response);
    const setCookies =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : ([headers.get("set-cookie")].filter(Boolean) as string[]);
    for (const cookie of setCookies) {
      res.headers.append("set-cookie", cookie);
    }
    return res;
  } catch (error) {
    if (error instanceof APIError) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === "SESSION_EXPIRED") {
        return NextResponse.json(
          { error: "Please confirm your password to delete your account", code },
          { status: 401 },
        );
      }
      if (code === "INVALID_PASSWORD" || code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Incorrect password", code },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: error.statusCode ?? 500 },
      );
    }
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
