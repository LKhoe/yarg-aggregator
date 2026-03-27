import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { installationSong, installation } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { MAX_ARRAY_INPUT } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(authUser.profile.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Verify installation exists
    const inst = await db
      .select()
      .from(installation)
      .where(eq(installation.id, id))
      .limit(1);

    if (inst.length === 0) {
      return NextResponse.json(
        { error: "Installation not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const songIds: string[] = body.songIds || (body.songId ? [body.songId] : []);

    if (songIds.length === 0) {
      return NextResponse.json(
        { error: "songId or songIds is required" },
        { status: 400 },
      );
    }

    if (songIds.length > MAX_ARRAY_INPUT) {
      return NextResponse.json(
        { error: `Too many songs. Maximum ${MAX_ARRAY_INPUT} per request.` },
        { status: 400 },
      );
    }

    // Filter out songs that are already linked
    const existing = await db
      .select({ songId: installationSong.songId })
      .from(installationSong)
      .where(eq(installationSong.installationId, id));

    const existingSet = new Set(existing.map((e) => e.songId));
    const newSongIds = songIds.filter((sid) => !existingSet.has(sid));

    if (newSongIds.length > 0) {
      await db.insert(installationSong).values(
        newSongIds.map((songId) => ({
          installationId: id,
          songId,
        })),
      );
    }

    return NextResponse.json({
      added: newSongIds.length,
      skipped: songIds.length - newSongIds.length,
    });
  } catch (error) {
    console.error("Error adding songs to installation:", error);
    return NextResponse.json(
      { error: "Failed to add songs" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(authUser.profile.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { songId } = body;

    if (!songId) {
      return NextResponse.json(
        { error: "songId is required" },
        { status: 400 },
      );
    }

    const result = await db
      .delete(installationSong)
      .where(
        and(
          eq(installationSong.installationId, id),
          eq(installationSong.songId, songId),
        ),
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Song not found in installation" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing song from installation:", error);
    return NextResponse.json(
      { error: "Failed to remove song" },
      { status: 500 },
    );
  }
}
