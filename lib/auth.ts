import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { userProfile, songList } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { createSign, randomUUID } from "crypto";
import { lastfmPlugin } from "@ley0x/better-auth-lastfm";

/**
 * Generate an Apple client secret JWT signed with the ES256 private key.
 * Apple requires this JWT as the OAuth client_secret for Sign in with Apple.
 * Set expiry to 180 days (Apple maximum). The server must restart before expiry to regenerate.
 */
function generateAppleClientSecret(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;

  if (!privateKey || !teamId || !clientId || !keyId) return "";

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 15552000, // 180 days
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(signingInput);
  const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }, "base64url");
  return `${signingInput}.${signature}`;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Sign-in is provider-only (Google, Spotify, Apple, Last.fm). Accounts created earlier with a
  // password get in through accountLinking below (same verified email from a trusted provider).
  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ["https://www.googleapis.com/auth/youtube.readonly"],
      accessType: "offline",
      prompt: "consent",
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      scope: ["playlist-read-private", "playlist-read-collaborative", "user-library-read"],
    },
    ...(process.env.APPLE_CLIENT_ID
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: generateAppleClientSecret(),
          },
        }
      : {}),
  },

  advanced: {
    // Behind the Cloudflare tunnel; x-forwarded-for's first entry is client-controlled.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    // Signed session snapshot in a cookie, so most getSession() calls skip the DB.
    // Trade-off: a revoked session (sign-out elsewhere, "revoke other sessions") can stay valid
    // for up to 5 minutes. Roles are NOT affected: admin/moderator live in user_profile, which
    // lib/middleware/auth.ts reads from the DB on every request (and a user without a profile row,
    // e.g. a deleted account, is rejected there even while the cookie is still cached).
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  user: {
    deleteUser: {
      enabled: true,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "spotify", "apple"],
      // Users who signed up with a password before it was removed have emailVerified=false (no
      // verification mail was ever sent). Without this, Better Auth refuses to attach the
      // Google/Spotify/Apple sign-in to that existing user ("account not linked"). Safe now that
      // password sign-in/sign-up is off: an unverified row can no longer be used by whoever created it.
      requireLocalEmailVerified: false,
    },
  },

  plugins: [
    ...(process.env.LASTFM_API_KEY && process.env.LASTFM_API_SECRET
      ? [
          lastfmPlugin({
            apiKey: process.env.LASTFM_API_KEY,
            sharedSecret: process.env.LASTFM_API_SECRET,
            redirectTo: "/",
          }),
        ]
      : []),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Generate a unique display name
          const baseDisplayName = user.name || user.email.split("@")[0];
          let displayName = baseDisplayName;
          let suffix = 1;

          // Check for existing display names and add suffix if needed
          while (true) {
            const existingResult = await db
              .select()
              .from(userProfile)
              .where(eq(userProfile.displayName, displayName))
              .limit(1);
            const existing = existingResult[0];
            if (!existing) break;
            displayName = `${baseDisplayName}${suffix}`;
            suffix++;
          }

          // First user gets admin role — use atomic SQL to avoid race condition
          await db.execute(sql`
            INSERT INTO user_profile (id, user_id, display_name, avatar_url, role)
            VALUES (
              ${randomUUID()},
              ${user.id},
              ${displayName},
              ${user.image ?? null},
              (CASE WHEN (SELECT COUNT(*) FROM user_profile) = 0 THEN 'admin' ELSE 'user' END)::role
            )
          `);

          // Create default favorites list
          await db.insert(songList).values({
            userId: user.id,
            name: "Favorites",
            slug: "favorites",
            isFavorites: true,
            isPublic: true,
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
