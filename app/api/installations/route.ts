import { NextResponse } from "next/server";
import { getAllInstallations } from "@/services/songs/installed";

export async function GET() {
  try {
    const installations = await getAllInstallations();
    return NextResponse.json({ installations });
  } catch (error) {
    console.error("Error fetching installations:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
