import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: listId, songId } = await params;

    const success = await ListService.removeSongFromList(listId, songId, authUser.id);

    if (!success) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing song from list:", error);
    return NextResponse.json({ error: "Failed to remove song from list" }, { status: 500 });
  }
}
