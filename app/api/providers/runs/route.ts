import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { providerFetchRun } from "@/lib/db/schema";
import type { FetchRunSummary, ProviderSource } from "@/types";

/** Recent fetch runs of a source: GET /api/providers/runs?source=enchor&limit=10 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source = request.nextUrl.searchParams.get("source") as ProviderSource | null;
  if (source !== "enchor" && source !== "rhythmverse") {
    return NextResponse.json(
      { error: "Invalid source. Must be enchor or rhythmverse" },
      { status: 400 },
    );
  }
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 10;

  try {
    const rows = await db
      .select()
      .from(providerFetchRun)
      .where(eq(providerFetchRun.source, source))
      .orderBy(desc(providerFetchRun.createdAt))
      .limit(limit);

    const runs: FetchRunSummary[] = rows.map((row) => ({
      id: row.id,
      source: row.source,
      mode: row.mode,
      status: row.status,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      songsFetched: row.songsFetched,
      added: row.added,
      updated: row.updated,
      ignored: row.ignored,
      parseIssues: row.parseIssues,
      failedPages: row.gaps.filter((g) => !g.pending).length,
      error: row.error,
    }));

    return NextResponse.json(runs);
  } catch (error) {
    console.error("Error listing fetch runs:", error);
    return NextResponse.json({ error: "Failed to list fetch runs" }, { status: 500 });
  }
}
