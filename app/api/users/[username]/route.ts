import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ListService } from "@/lib/services/list";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const profileResult = await db.select().from(userProfile).where(eq(userProfile.displayName, username)).limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const lists = await ListService.getPublicLists(profile.userId);

    return NextResponse.json({
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        slug: list.slug,
        songCount: list.itemCount,
      })),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}
