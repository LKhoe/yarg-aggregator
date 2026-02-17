import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { userProfile, songList } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
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
      scope: ["playlist-read-private", "playlist-read-collaborative"],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "spotify"],
    },
  },

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

          // First user gets admin role, everyone else gets user
          const existingProfiles = await db
            .select({ id: userProfile.userId })
            .from(userProfile)
            .limit(1);
          const role = existingProfiles.length === 0 ? "admin" : "user";

          await db.insert(userProfile).values({
            userId: user.id,
            displayName,
            avatarUrl: user.image,
            role,
          });

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
