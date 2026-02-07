import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);
  const { id: listId } = await params;

  try {
    const list = await ListService.getListById(listId, authUser?.id);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: list.id,
      name: list.name,
      slug: list.slug,
      isFavorites: list.isFavorites,
      isPublic: list.isPublic,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      items: list.items.map((item) => ({
        id: item.id,
        addedAt: item.addedAt,
        song: {
          id: item.song.id,
          title: item.song.title,
          artist: item.song.artist.name,
          album: item.song.album?.name ?? null,
          albumImageUrl: item.song.albumImageUrl,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching list:", error);
    return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
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

  try {
    const { id: listId } = await params;
    const body = await request.json();
    const { name, isPublic } = body;

    if (name !== undefined && (typeof name !== "string" || name.length < 1 || name.length > 50)) {
      return NextResponse.json(
        { error: "Name must be between 1 and 50 characters" },
        { status: 400 },
      );
    }

    const updated = await ListService.updateList(listId, authUser.id, {
      name,
      isPublic,
    });

    if (!updated) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      isFavorites: updated.isFavorites,
      isPublic: updated.isPublic,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating list:", error);
    return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
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

  try {
    const { id: listId } = await params;

    const success = await ListService.deleteList(listId, authUser.id);

    if (!success) {
      return NextResponse.json(
        { error: "List not found or cannot be deleted" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting list:", error);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
