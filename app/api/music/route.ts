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

    // Validate all IDs are strings
    if (!musicIds.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json(
        { error: "All musicIds must be strings" },
        { status: 400 },
      );
    }

    // Validate UUID format
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = musicIds.filter((id: string) => UUID_REGEX.test(id));

    // Limit the number of IDs to prevent excessive database queries
    const limitedIds = validIds.slice(0, 100);
    if (validIds.length > 100) {
      console.warn(
        `Batch request limited to 100 items (requested ${validIds.length})`,
      );
    }

    // Find all music documents by their IDs in a single query
    const musicData = await MusicService.findByIds(limitedIds);

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

    // Validate sortBy against whitelist
    const validSortBy = [
      "name",
      "artist",
      "album",
      "createdAt",
      "relevance",
    ] as const;
    const rawSortBy = searchParams.get("sortBy") || "createdAt";
    const sortBy = validSortBy.includes(
      rawSortBy as (typeof validSortBy)[number],
    )
      ? (rawSortBy as SearchParams["sortBy"])
      : "createdAt";

    // Validate sortOrder
    const rawSortOrder = searchParams.get("sortOrder") || "desc";
    const sortOrder = rawSortOrder === "asc" ? "asc" : "desc";

    // Validate source
    const validSources = ["", "enchor", "rhythmverse"] as const;
    const rawSource = searchParams.get("source") || "";
    const source = validSources.includes(
      rawSource as (typeof validSources)[number],
    )
      ? (rawSource as SearchParams["source"])
      : "";

    // Validate instruments against known values
    const validInstruments = ["guitar", "bass", "drums", "keys", "vocals"];
    const instruments = instrumentsParam
      ? instrumentsParam.split(",").filter((i) => validInstruments.includes(i))
      : [];

    const params: SearchParams = {
      query: searchParams.get("query") || "",
      limit: Math.min(
        Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
        100,
      ),
      sortBy,
      sortOrder,
      genre: searchParams.get("genre") || "",
      instruments,
      source,
      cursor: searchParams.get("cursor"),
      installationId: searchParams.get("installationId") || null,
      installed: searchParams.get("installed") === "true",
      artist: searchParams.get("artist") || undefined,
      album: searchParams.get("album") || undefined,
      charter: searchParams.get("charter") || undefined,
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
