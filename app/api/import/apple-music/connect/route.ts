import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Music user tokens are valid for up to 6 months
const MUSIC_USER_TOKEN_TTL_MS = 15552000 * 1000;

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { musicUserToken } = body;

  if (!musicUserToken || typeof musicUserToken !== "string") {
    return NextResponse.json(
      { error: "Missing musicUserToken" },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + MUSIC_USER_TOKEN_TTL_MS);

  const [existing] = await db
    .select()
    .from(account)
    .where(
      and(eq(account.userId, authUser.id), eq(account.providerId, "apple")),
    )
    .limit(1);

  if (existing) {
    await db
      .update(account)
      .set({
        accessToken: musicUserToken,
        accessTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(account.id, existing.id));
  } else {
    await db.insert(account).values({
      id: randomUUID(),
      userId: authUser.id,
      accountId: authUser.id,
      providerId: "apple",
      accessToken: musicUserToken,
      accessTokenExpiresAt: expiresAt,
    });
  }

  return NextResponse.json({ ok: true });
}
