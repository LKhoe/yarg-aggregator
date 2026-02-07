import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { genre } from "@/lib/db/schema";
import { ilike, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const all = searchParams.get("all") === "true";
    const q = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = parseInt(searchParams.get("cursor") || "0", 10);

    const conditions = [];
    if (q) {
      conditions.push(ilike(genre.name, `%${q}%`));
    }

    const baseQuery = db
      .select({ id: genre.id, name: genre.name })
      .from(genre);

    const query = conditions.length > 0
      ? baseQuery.where(conditions[0])
      : baseQuery;

    if (all) {
      const genres = await query.orderBy(asc(genre.name));
      return NextResponse.json({ genres, hasMore: false, nextCursor: null });
    }

    const genres = await query
      .orderBy(asc(genre.name))
      .limit(limit + 1)
      .offset(cursor);

    const hasMore = genres.length > limit;
    const resultGenres = hasMore ? genres.slice(0, limit) : genres;

    return NextResponse.json({
      genres: resultGenres,
      hasMore,
      nextCursor: hasMore ? cursor + limit : null,
    });
  } catch (error) {
    console.error("Error fetching genres:", error);
    return NextResponse.json(
      { error: "Failed to fetch genres" },
      { status: 500 },
    );
  }
}
