import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/db/schema";
import { ilike, asc, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const conditions = [];
    if (q) {
      conditions.push(ilike(userProfile.displayName, `%${q}%`));
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
