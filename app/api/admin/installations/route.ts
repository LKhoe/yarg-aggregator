import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { installation, installationSong } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

export const GET = withAuth(
  async () => {
    try {
      const installations = await db
        .select({
          id: installation.id,
          name: installation.name,
          path: installation.path,
          createdAt: installation.createdAt,
          updatedAt: installation.updatedAt,
          songCount: count(installationSong.id),
        })
        .from(installation)
        .leftJoin(
          installationSong,
          eq(installation.id, installationSong.installationId),
        )
        .groupBy(installation.id)
        .orderBy(desc(installation.createdAt));

      return NextResponse.json({ installations });
    } catch (error) {
      console.error("Error fetching installations:", error);
      return NextResponse.json(
        { error: "Failed to fetch installations" },
        { status: 500 },
      );
    }
  },
  { requiredRole: "admin" },
);
