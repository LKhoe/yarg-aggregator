import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createSign } from "crypto";

const REQUIRED_SCOPES: Record<string, string[]> = {
  google: ["https://www.googleapis.com/auth/youtube.readonly"],
  spotify: ["playlist-read-private", "playlist-read-collaborative"],
  apple: [], // No OAuth scopes — just needs a stored music user token
  lastfm: [], // No OAuth scopes — session key stored in accessToken
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

/**
 * Generate a MusicKit developer token JWT (server-side, used as Bearer token
 * alongside the user's Music-User-Token to call Apple Music API).
 * Uses APPLE_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY env vars.
 */
export function generateAppleMusicDeveloperToken(): string {
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;

  if (!privateKey || !teamId || !keyId) {
    throw new Error(
      "Apple Music not configured: missing APPLE_TEAM_ID, APPLE_MUSIC_KEY_ID, or APPLE_MUSIC_PRIVATE_KEY",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 15552000, // 180 days
    }),
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(signingInput);
  const signature = sign.sign(
    { key: privateKey, dsaEncoding: "ieee-p1363" },
    "base64url",
  );
  return `${signingInput}.${signature}`;
}

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
  const required = REQUIRED_SCOPES[providerId];
  if (!required) return false;
  // No scopes required (e.g. apple-music uses a music user token, not OAuth scopes)
  if (required.length === 0) return true;
  if (!accountScope) return false;
  // Better Auth stores scopes as comma-separated
  const granted = accountScope.split(",");
  return required.every((scope) => granted.includes(scope));
}

export async function getLastfmUsername(userId: string): Promise<string | null> {
  const acc = await getLinkedAccount(userId, "lastfm");
  return acc?.accountId ?? null;
}

export async function getValidAccessToken(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const acc = await getLinkedAccount(userId, providerId);
  if (!acc || !acc.accessToken) return null;

  // No expiry set — token doesn't expire (e.g. Last.fm session keys)
  if (!acc.accessTokenExpiresAt) {
    return acc.accessToken;
  }

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
