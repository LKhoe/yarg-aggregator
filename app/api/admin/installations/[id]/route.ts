import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { installation, installationSong, song, artist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
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

    const result = await db
      .select()
      .from(installation)
      .where(eq(installation.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Installation not found" },
        { status: 404 },
      );
    }

    const songs = await db
      .select({
        id: installationSong.id,
        songId: song.id,
        title: song.title,
        artistName: artist.name,
        installedAt: installationSong.installedAt,
      })
      .from(installationSong)
      .innerJoin(song, eq(installationSong.songId, song.id))
      .innerJoin(artist, eq(song.artistId, artist.id))
      .where(eq(installationSong.installationId, id));

    return NextResponse.json({
      installation: result[0],
      songs,
    });
  } catch (error) {
    console.error("Error fetching installation:", error);
    return NextResponse.json(
      { error: "Failed to fetch installation" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    const result = await db
      .update(installation)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(installation.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Installation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ installation: result[0] });
  } catch (error) {
    console.error("Error updating installation:", error);
    return NextResponse.json(
      { error: "Failed to update installation" },
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

    const result = await db
      .delete(installation)
      .where(eq(installation.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Installation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting installation:", error);
    return NextResponse.json(
      { error: "Failed to delete installation" },
      { status: 500 },
    );
  }
}
