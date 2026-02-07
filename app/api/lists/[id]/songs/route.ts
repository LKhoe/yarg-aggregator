import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: listId } = await params;
    const body = await request.json();
    const { songId } = body;

    if (!songId || typeof songId !== "string") {
      return NextResponse.json({ error: "Song ID is required" }, { status: 400 });
    }

    const item = await ListService.addSongToList(listId, songId, authUser.id);

    if (!item) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: item.id,
      listId: item.listId,
      songId: item.songId,
      addedAt: item.addedAt,
    });
  } catch (error) {
    console.error("Error adding song to list:", error);
    return NextResponse.json({ error: "Failed to add song to list" }, { status: 500 });
  }
}
