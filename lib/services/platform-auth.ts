import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const REQUIRED_SCOPES: Record<string, string[]> = {
  google: ["https://www.googleapis.com/auth/youtube.readonly"],
  spotify: ["playlist-read-private", "playlist-read-collaborative"],
};

const TOKEN_ENDPOINTS: Record<string, string> = {
  google: "https://oauth2.googleapis.com/token",
  spotify: "https://accounts.spotify.com/api/token",
};

const CLIENT_CREDENTIALS: Record<
  string,
  { clientId: string; clientSecret: string }
> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  },
};

export async function getLinkedAccount(userId: string, providerId: string) {
  const [acc] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, providerId)))
    .limit(1);
  return acc ?? null;
}

export function hasRequiredScopes(
  accountScope: string | null,
  providerId: string,
): boolean {
  if (!accountScope) return false;
  const required = REQUIRED_SCOPES[providerId];
  if (!required) return false;
  // Better Auth stores scopes as comma-separated
  const granted = accountScope.split(",");
  return required.every((scope) => granted.includes(scope));
}

export async function getValidAccessToken(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const acc = await getLinkedAccount(userId, providerId);
  if (!acc || !acc.accessToken) return null;

  // Check if token is still valid (with 5-minute buffer)
  if (acc.accessTokenExpiresAt) {
    const bufferMs = 5 * 60 * 1000;
    if (acc.accessTokenExpiresAt.getTime() - bufferMs > Date.now()) {
      return acc.accessToken;
    }
  }

  // Token expired — try to refresh
  if (!acc.refreshToken) return null;

  try {
    const creds = CLIENT_CREDENTIALS[providerId];
    if (!creds) return null;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: acc.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const response = await fetch(TOKEN_ENDPOINTS[providerId], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const newAccessToken: string = data.access_token;
    const expiresIn: number = data.expires_in;
    const newRefreshToken: string | undefined = data.refresh_token;

    // Update the account row
    await db
      .update(account)
      .set({
        accessToken: newAccessToken,
        accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
        updatedAt: new Date(),
      })
      .where(eq(account.id, acc.id));

    return newAccessToken;
  } catch {
    return null;
  }
}
