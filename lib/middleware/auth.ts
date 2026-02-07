import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Role, UserProfile } from "@/lib/db/schema";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  profile: UserProfile;
};

const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

export async function getAuthenticatedUser(
  request?: NextRequest,
): Promise<AuthenticatedUser | null> {
  try {
    const headersList = request
      ? new Headers(request.headers)
      : await headers();

    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user) {
      return null;
    }

    const profileResult = await db.select().from(userProfile).where(eq(userProfile.userId, session.user.id)).limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image || null,
      emailVerified: session.user.emailVerified,
      profile,
    };
  } catch {
    return null;
  }
}

export function hasPermission(
  userRole: Role,
  requiredRole: Role,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export type WithAuthOptions = {
  requiredRole?: Role;
};

type RouteHandler = (
  request: NextRequest,
  context: { user: AuthenticatedUser },
) => Promise<NextResponse> | NextResponse;

export function withAuth(
  handler: RouteHandler,
  options: WithAuthOptions = {},
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (options.requiredRole) {
      if (!hasPermission(user.profile.role, options.requiredRole)) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 },
        );
      }
    }

    return handler(request, { user });
  };
}
