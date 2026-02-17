import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { getValidAccessToken } from "@/lib/services/platform-auth";
import { getPlaylistTracks } from "@/services/platforms/spotify-user";
import { getPlaylistItems } from "@/services/platforms/youtube-user";
import { PlaylistMatcherService } from "@/lib/services/playlist-matcher";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, playlistId } = body;

    if (!provider || !playlistId) {
      return NextResponse.json({ error: "Missing provider or playlistId" }, { status: 400 });
    }

    if (provider !== "spotify" && provider !== "google") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(authUser.id, provider);
    if (!accessToken) {
      return NextResponse.json({ error: "reauth_required", provider }, { status: 401 });
    }

    // Fetch tracks from the platform
    let tracks: { title: string; artist: string }[];

    if (provider === "spotify") {
      const spotifyTracks = await getPlaylistTracks(accessToken, playlistId);
      tracks = spotifyTracks.map((t) => ({ title: t.title, artist: t.artist }));
    } else {
      tracks = await getPlaylistItems(accessToken, playlistId);
    }

    // Match tracks against our database
    const results = await PlaylistMatcherService.matchTracks(tracks);

    const matched = results.filter((r) => r.match !== null);
    const unmatched = results.filter((r) => r.match === null);

    return NextResponse.json({
      results,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      totalCount: results.length,
    });
  } catch (error) {
    console.error("Error matching playlist:", error);
    return NextResponse.json({ error: "Failed to match playlist" }, { status: 500 });
  }
}
