import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { getQueueStats, getDbStats, getErrors } from "@/lib/monitoring";

export const GET = withAuth(
  async () => {
    try {
      const [queue, db, errors] = await Promise.all([
        getQueueStats(),
        getDbStats(),
        getErrors(),
      ]);

      return NextResponse.json({ queue, db, errors });
    } catch (error) {
      console.error("Error fetching monitoring data:", error);
      return NextResponse.json(
        { error: "Failed to fetch monitoring data" },
        { status: 500 },
      );
    }
  },
  { requiredRole: "admin" },
);
