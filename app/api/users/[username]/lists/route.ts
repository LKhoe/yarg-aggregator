import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ListService } from "@/lib/services/list";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    // Find user by display name
    const profileResult = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.displayName, username))
      .limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const slug = request.nextUrl.searchParams.get("slug");

    // If slug is provided, return a single list with songs
    if (slug) {
      const list = await ListService.getListBySlug(profile.userId, slug);

      if (!list || !list.isPublic) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: list.id,
        name: list.name,
        slug: list.slug,
        owner: {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
        songs: list.items.map((item) => ({
          id: item.song.id,
          name: item.song.title,
          artist: item.song.artist.name,
          album: item.song.album?.name ?? null,
          addedAt: item.addedAt,
          downloadUrls: item.song.downloadUrls,
        })),
      });
    }

    const lists = await ListService.getPublicLists(profile.userId);

    return NextResponse.json(
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        slug: list.slug,
        isFavorites: list.isFavorites,
        itemCount: list.itemCount,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
    );
  } catch (error) {
    console.error("Error fetching user lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 },
    );
  }
}
