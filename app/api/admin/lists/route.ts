import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { songList, songListItem, userProfile } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

export const GET = withAuth(
  async () => {
    try {
      const lists = await db
        .select({
          id: songList.id,
          name: songList.name,
          slug: songList.slug,
          isFavorites: songList.isFavorites,
          isPublic: songList.isPublic,
          createdAt: songList.createdAt,
          ownerDisplayName: userProfile.displayName,
          itemCount: count(songListItem.id),
        })
        .from(songList)
        .innerJoin(userProfile, eq(songList.userId, userProfile.userId))
        .leftJoin(songListItem, eq(songList.id, songListItem.listId))
        .groupBy(songList.id, userProfile.displayName)
        .orderBy(desc(songList.createdAt));

      return NextResponse.json({ lists });
    } catch (error) {
      console.error("Error fetching lists:", error);
      return NextResponse.json(
        { error: "Failed to fetch lists" },
        { status: 500 },
      );
    }
  },
  { requiredRole: "admin" },
);
