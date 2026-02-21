import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { songList, songListItem, installationSong } from "@/lib/db/schema";
import { eq, and, inArray, or } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: listId } = await params;
  const installationId = request.nextUrl.searchParams.get("installationId");

  if (!installationId) {
    return NextResponse.json({ installedSongIds: [] });
  }

  try {
    // Verify the list is accessible (owned by user or public)
    const listResult = await db
      .select({ id: songList.id })
      .from(songList)
      .where(
        and(
          eq(songList.id, listId),
          or(eq(songList.userId, authUser.id), eq(songList.isPublic, true)),
        ),
      )
      .limit(1);

    if (!listResult[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get all song IDs from the list
    const items = await db
      .select({ songId: songListItem.songId })
      .from(songListItem)
      .where(eq(songListItem.listId, listId));

    const songIds = items.map((i) => i.songId);

    if (songIds.length === 0) {
      return NextResponse.json({ installedSongIds: [] });
    }

    // Check which song IDs are installed in the given installation
    const installed = await db
      .select({ songId: installationSong.songId })
      .from(installationSong)
      .where(
        and(
          eq(installationSong.installationId, installationId),
          inArray(installationSong.songId, songIds),
        ),
      );

    return NextResponse.json({ installedSongIds: installed.map((i) => i.songId) });
  } catch (error) {
    console.error("Error checking installed songs:", error);
    return NextResponse.json({ error: "Failed to check installed songs" }, { status: 500 });
  }
}
