import { NextRequest, NextResponse } from "next/server";
import type { MusicPlatform } from "@/types";
import {
  searchDeezer,
  searchSpotify,
  searchYouTube,
  searchSoundCloud,
} from "@/services/platforms";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

const VALID_PLATFORMS: MusicPlatform[] = [
  "deezer",
  "spotify",
  "youtube",
  "soundcloud",
];

const PLATFORM_ENV_KEYS: Record<MusicPlatform, string[]> = {
  deezer: [], // No auth required
  spotify: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
  youtube: ["YOUTUBE_API_KEY"],
  soundcloud: ["SOUNDCLOUD_CLIENT_ID"],
};

function isPlatformConfigured(platform: MusicPlatform): boolean {
  const keys = PLATFORM_ENV_KEYS[platform];
  if (keys.length === 0) return true;
  return keys.every((key) => !!process.env[key]);
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const song = searchParams.get("song")?.trim();
    const artist = searchParams.get("artist")?.trim();
    const platform = searchParams.get("platform") as MusicPlatform | null;

    if (!song || !platform) {
      return NextResponse.json(
        { error: "song and platform are required" },
        { status: 400 },
      );
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform" },
        { status: 400 },
      );
    }

    if (!isPlatformConfigured(platform)) {
      return NextResponse.json({ result: null, configured: false });
    }

    const searchers: Record<
      MusicPlatform,
      (song: string, artist: string) => ReturnType<typeof searchDeezer>
    > = {
      deezer: searchDeezer,
      spotify: searchSpotify,
      youtube: searchYouTube,
      soundcloud: searchSoundCloud,
    };

    const result = await searchers[platform](song, artist || "");

    return NextResponse.json({ result, configured: true });
  } catch (error) {
    console.error("Error searching platform:", error);
    return NextResponse.json(
      { error: "Failed to search platform" },
      { status: 500 },
    );
  }
}
