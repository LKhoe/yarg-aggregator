import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";
import { MAX_ARRAY_INPUT } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, isPublic = true, songIds, existingListId } = body;

    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json({ error: "No songs to import" }, { status: 400 });
    }

    if (songIds.length > MAX_ARRAY_INPUT) {
      return NextResponse.json(
        { error: `Too many songs. Maximum ${MAX_ARRAY_INPUT} per request.` },
        { status: 400 },
      );
    }

    let listId: string;

    if (existingListId) {
      // Add to existing list
      listId = existingListId;
    } else {
      // Create new list
      if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
        return NextResponse.json({ error: "Name must be between 1 and 50 characters" }, { status: 400 });
      }
      const newList = await ListService.createList(authUser.id, name, isPublic);
      listId = newList.id;
    }

    const addedCount = await ListService.addSongsToList(listId, songIds, authUser.id);

    return NextResponse.json({
      listId,
      addedCount,
      totalSongs: songIds.length,
    });
  } catch (error) {
    console.error("Error creating import list:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
