import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import {
  processSerializedInstalledSongs,
  type InstallationInfo,
  type InstalledSongsStats,
} from "@/services/songs/installed";
import { type SerializedSongEntry } from "@/services/songs/serialization";

export interface ImportInstalledSongsRequest {
  installation: InstallationInfo;
  songs: SerializedSongEntry[];
}

export interface ImportInstalledSongsResponse {
  success: boolean;
  stats?: InstalledSongsStats;
  error?: string;
}

const MAX_SONGS_PER_REQUEST = 10000;

export const POST = withAuth(
  async (
    request: NextRequest,
  ): Promise<NextResponse<ImportInstalledSongsResponse>> => {
    try {
      const body = (await request.json()) as ImportInstalledSongsRequest;

      if (!body.installation || !body.installation.name) {
        return NextResponse.json(
          { success: false, error: "Installation name is required" },
          { status: 400 },
        );
      }

      if (!Array.isArray(body.songs)) {
        return NextResponse.json(
          { success: false, error: "Songs must be an array" },
          { status: 400 },
        );
      }

      if (body.songs.length > MAX_SONGS_PER_REQUEST) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many songs. Maximum ${MAX_SONGS_PER_REQUEST} per request.`,
          },
          { status: 400 },
        );
      }

      const stats = await processSerializedInstalledSongs(
        body.installation,
        body.songs,
      );

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Error importing installed songs:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        { status: 500 },
      );
    }
  },
  { requiredRole: "user" },
);
