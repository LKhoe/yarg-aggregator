import { db } from "@/lib/db";
import { user, userProfile, songList, session, trustedDevice, account } from "@/lib/db/schema";
import { eq, ilike, or, sql, and, ne } from "drizzle-orm";
import type { Role, UserProfile } from "@/lib/db/schema";

export type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  profile: UserProfile;
};

export type PublicProfile = {
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export class UserService {
  static async getById(userId: string): Promise<UserWithProfile | null> {
    const result = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    const userRecord = result[0];

    if (!userRecord) {
      return null;
    }

    const profileResult = await db.select().from(userProfile).where(eq(userProfile.userId, userRecord.id)).limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return null;
    }

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      image: userRecord.image,
      emailVerified: userRecord.emailVerified ?? false,
      createdAt: userRecord.createdAt,
      profile,
    };
  }

  static async getByDisplayName(displayName: string): Promise<PublicProfile | null> {
    const profileResult = await db.select().from(userProfile).where(eq(userProfile.displayName, displayName)).limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return null;
    }

    return {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
    };
  }

  static async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      preferredLanguage?: string;
    },
  ): Promise<UserProfile | null> {
    // Check if displayName is taken (if being updated)
    if (data.displayName) {
      const existingResult = await db.select().from(userProfile).where(and(eq(userProfile.displayName, data.displayName!), ne(userProfile.userId, userId))).limit(1);
      const existing = existingResult[0];

      if (existing) {
        throw new Error("Display name already taken");
      }
    }

    const [updated] = await db
      .update(userProfile)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, userId))
      .returning();

    return updated ?? null;
  }

  static async updateRole(
    userId: string,
    role: Role,
  ): Promise<UserProfile | null> {
    const [updated] = await db
      .update(userProfile)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.userId, userId))
      .returning();

    return updated ?? null;
  }

  static async deleteUser(userId: string): Promise<boolean> {
    // Due to cascade delete, this will remove all related data
    await db.delete(user).where(eq(user.id, userId));
    return true;
  }

  static async searchUsers(
    query: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ users: UserWithProfile[]; total: number }> {
    const searchPattern = `%${query}%`;

    const results = await db
      .select()
      .from(user)
      .innerJoin(userProfile, eq(user.id, userProfile.userId))
      .where(
        or(
          ilike(user.email, searchPattern),
          ilike(user.name, searchPattern),
          ilike(userProfile.displayName, searchPattern),
        ),
      )
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .innerJoin(userProfile, eq(user.id, userProfile.userId))
      .where(
        or(
          ilike(user.email, searchPattern),
          ilike(user.name, searchPattern),
          ilike(userProfile.displayName, searchPattern),
        ),
      );

    const users = results.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      image: r.user.image,
      emailVerified: r.user.emailVerified ?? false,
      createdAt: r.user.createdAt,
      profile: r.user_profile,
    }));

    return {
      users,
      total: Number(countResult?.count ?? 0),
    };
  }

  static async getAllUsers(
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ users: UserWithProfile[]; total: number }> {
    const results = await db
      .select()
      .from(user)
      .innerJoin(userProfile, eq(user.id, userProfile.userId))
      .orderBy(user.createdAt)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);

    const users = results.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      image: r.user.image,
      emailVerified: r.user.emailVerified ?? false,
      createdAt: r.user.createdAt,
      profile: r.user_profile,
    }));

    return {
      users,
      total: Number(countResult?.count ?? 0),
    };
  }
}
