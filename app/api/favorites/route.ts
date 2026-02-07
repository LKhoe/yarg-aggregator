import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { songId } = body;

    if (!songId || typeof songId !== "string") {
      return NextResponse.json({ error: "Song ID is required" }, { status: 400 });
    }

    const isFavorited = await ListService.toggleFavorite(authUser.id, songId);

    return NextResponse.json({
      songId,
      isFavorited,
    });
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return NextResponse.json({ error: "Failed to toggle favorite" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("songId");

    if (!songId) {
      return NextResponse.json({ error: "Song ID is required" }, { status: 400 });
    }

    const isFavorited = await ListService.isSongInFavorites(authUser.id, songId);

    return NextResponse.json({
      songId,
      isFavorited,
    });
  } catch (error) {
    console.error("Error checking favorite:", error);
    return NextResponse.json({ error: "Failed to check favorite" }, { status: 500 });
  }
}
