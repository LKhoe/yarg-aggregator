import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { ilike, asc, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { escapeLikePattern } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || "";
    const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 20;

    const conditions = [];
    if (q) {
      conditions.push(ilike(userProfile.displayName, `%${escapeLikePattern(q)}%`));
    }

    const baseQuery = db
      .select({
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl,
        createdAt: userProfile.createdAt,
      })
      .from(userProfile);

    const query = conditions.length > 0
      ? baseQuery.where(conditions[0])
      : baseQuery;

    const users = await query
      .orderBy(asc(userProfile.displayName))
      .limit(limit);

    const [countResult] = await (conditions.length > 0
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(userProfile)
          .where(conditions[0])
      : db.select({ count: sql<number>`count(*)` }).from(userProfile));

    return NextResponse.json({
      users,
      total: Number(countResult?.count ?? 0),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
