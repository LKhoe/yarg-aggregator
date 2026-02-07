import { NextRequest, NextResponse } from "next/server";
import { MusicService } from "@/lib/services/music";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import type { SearchParams } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { musicIds } = body;

    if (!musicIds || !Array.isArray(musicIds)) {
      return NextResponse.json(
        { error: "musicIds must be an array" },
        { status: 400 },
      );
    }

    if (musicIds.length === 0) {
      return NextResponse.json([]);
    }

    // Limit the number of IDs to prevent excessive database queries
    const limitedIds = musicIds.slice(0, 100);
    if (musicIds.length > 100) {
      console.warn(
        `Batch request limited to 100 items (requested ${musicIds.length})`,
      );
    }

    // Find all music documents by their IDs in parallel
    const musicPromises = limitedIds.map((id) => MusicService.findById(id));
    const musicResults = await Promise.all(musicPromises);
    const musicData = musicResults.filter((music) => music !== null);

    return NextResponse.json(musicData);
  } catch (error) {
    console.error("Error fetching batch music:", error);
    return NextResponse.json(
      { error: "Failed to fetch music data" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Optional auth - don't fail for unauthenticated users
    const authUser = await getAuthenticatedUser(request).catch(() => null);

    const searchParams = request.nextUrl.searchParams;

    const instrumentsParam = searchParams.get("instruments");
    const params: SearchParams = {
      query: searchParams.get("query") || "",
      limit: Math.min(parseInt(searchParams.get("limit") || "20", 10), 100),
      sortBy: (searchParams.get("sortBy") as SearchParams["sortBy"]) || "createdAt",
      sortOrder:
        (searchParams.get("sortOrder") as SearchParams["sortOrder"]) || "desc",
      genre: searchParams.get("genre") || "",
      instruments: instrumentsParam
        ? instrumentsParam.split(",").filter(Boolean)
        : [],
      source: (searchParams.get("source") as SearchParams["source"]) || "",
      cursor: searchParams.get("cursor"),
      installationId: searchParams.get("installationId") || null,
      installed: searchParams.get("installed") === "true",
    };

    const response = await MusicService.search(params, authUser?.id);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching music:", error);
    return NextResponse.json(
      { error: "Failed to fetch music" },
      { status: 500 },
    );
  }
}
