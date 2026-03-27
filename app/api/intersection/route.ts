import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";
import { MAX_LIST_IDS } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { myListIds = [], publicListIds = [], minCount = 1, installationId } = body;

    const allListIds = [...myListIds, ...publicListIds];

    if (allListIds.length === 0) {
      return NextResponse.json({ error: "At least one list is required" }, { status: 400 });
    }

    if (allListIds.length > MAX_LIST_IDS) {
      return NextResponse.json(
        { error: `Too many lists. Maximum ${MAX_LIST_IDS} per request.` },
        { status: 400 },
      );
    }

    if (typeof minCount !== "number" || minCount < 1) {
      return NextResponse.json({ error: "minCount must be at least 1" }, { status: 400 });
    }

    const songs = await ListService.getIntersectionSongs(
      allListIds,
      minCount,
      installationId ?? null,
    );

    return NextResponse.json({ songs, total: songs.length });
  } catch (error) {
    console.error("Error computing intersection:", error);
    return NextResponse.json({ error: "Failed to compute intersection" }, { status: 500 });
  }
}
