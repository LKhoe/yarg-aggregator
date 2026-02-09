import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { songListItem } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(_request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(authUser.profile.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const items = await db
      .select({ songId: songListItem.songId })
      .from(songListItem)
      .where(eq(songListItem.listId, id));

    return NextResponse.json({
      songIds: items.map((item) => item.songId),
    });
  } catch (error) {
    console.error("Error fetching list songs:", error);
    return NextResponse.json(
      { error: "Failed to fetch list songs" },
      { status: 500 },
    );
  }
}
