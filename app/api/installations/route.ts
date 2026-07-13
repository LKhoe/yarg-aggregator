import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { getAllInstallations } from "@/services/songs/installed";

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const installations = await getAllInstallations();
    return NextResponse.json({ installations });
  } catch (error) {
    console.error("Error fetching installations:", error);
    return NextResponse.json(
      { error: "Failed to fetch installations" },
      { status: 500 },
    );
  }
});
