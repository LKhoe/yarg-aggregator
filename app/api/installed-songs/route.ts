import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import {
  processSerializedInstalledSongs,
  type InstallationInfo,
  type InstalledSongsStats,
} from "@/services/songs/installed";
import { type SerializedSongEntry } from "@/services/songs/serialization";
import { installedSongsRateLimit } from "@/lib/services/rate-limit";

const MAX_INSTALLATION_NAME_LENGTH = 100;
const MAX_INSTALLATION_PATH_LENGTH = 500;

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
    { user },
  ): Promise<NextResponse<ImportInstalledSongsResponse>> => {
    try {
      const rl = await installedSongsRateLimit(user.id);
      if (rl.blocked) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please wait before uploading again." },
          {
            status: 429,
            headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined,
          },
        );
      }

      const body = (await request.json()) as ImportInstalledSongsRequest;

      if (
        !body.installation ||
        typeof body.installation.name !== "string" ||
        body.installation.name.trim().length === 0 ||
        body.installation.name.length > MAX_INSTALLATION_NAME_LENGTH
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Installation name must be between 1 and ${MAX_INSTALLATION_NAME_LENGTH} characters`,
          },
          { status: 400 },
        );
      }

      if (
        body.installation.path !== undefined &&
        (typeof body.installation.path !== "string" ||
          body.installation.path.length > MAX_INSTALLATION_PATH_LENGTH)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Installation path must be at most ${MAX_INSTALLATION_PATH_LENGTH} characters`,
          },
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
        { success: false, error: "Failed to import installed songs" },
        { status: 500 },
      );
    }
  },
  { requiredRole: "user" },
);
