import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { getPublicPlaylistTracks as getSpotifyTracks } from "@/services/platforms/spotify-public";
import { getPublicPlaylistTracks as getYouTubeTracks } from "@/services/platforms/youtube-public";
import { PlaylistMatcherService } from "@/lib/services/playlist-matcher";

function detectPlatform(url: string): "spotify" | "youtube" | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "open.spotify.com") return "spotify";
    if (
      parsed.hostname === "music.youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      return "youtube";
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    let tracks: { title: string; artist: string }[];
    let playlistName: string;

    if (platform === "spotify") {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "not_configured" }, { status: 500 });
      }
      const result = await getSpotifyTracks(url, clientId, clientSecret);
      tracks = result.tracks;
      playlistName = result.playlistName;
    } else {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "not_configured" }, { status: 500 });
      }
      const result = await getYouTubeTracks(url, apiKey);
      tracks = result.tracks;
      playlistName = result.playlistName;
    }

    // Validate it looks like a playlist URL (has an ID)
    if (tracks === undefined) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    const results = await PlaylistMatcherService.matchTracks(tracks);

    const matched = results.filter((r) => r.match !== null);
    const unmatched = results.filter((r) => r.match === null);

    return NextResponse.json({
      results,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      totalCount: results.length,
      playlistName,
    });
  } catch (error) {
    console.error("Error importing from URL:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Invalid")) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to import playlist" }, { status: 500 });
  }
}
