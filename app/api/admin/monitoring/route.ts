import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { getQueueStats, getDbStats, getErrors, getVitals } from "@/lib/monitoring";

export const GET = withAuth(
  async () => {
    try {
      const [queue, db, errors, vitals] = await Promise.all([
        getQueueStats(),
        getDbStats(),
        getErrors(),
        getVitals(),
      ]);

      return NextResponse.json({ queue, db, errors, vitals });
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
