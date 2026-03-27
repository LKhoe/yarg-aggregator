import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import {
  getValidAccessToken,
  generateAppleMusicDeveloperToken,
} from "@/lib/services/platform-auth";
import {
  getPlaylistTracks,
  getLikedTracks,
} from "@/services/platforms/spotify-user";
import { getPlaylistItems } from "@/services/platforms/youtube-user";
import { getPlaylistTracks as getAppleMusicPlaylistTracks } from "@/services/platforms/apple-music-user";
import {
  getLovedTracks,
  getRecentTracks,
  getPersonalTagTracks,
} from "@/services/platforms/lastfm-user";
import { PlaylistMatcherService } from "@/lib/services/playlist-matcher";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, playlistId, lastfmUsername } = body;

    if (!provider || !playlistId) {
      return NextResponse.json(
        { error: "Missing provider or playlistId" },
        { status: 400 },
      );
    }

    if (
      provider !== "spotify" &&
      provider !== "google" &&
      provider !== "apple" &&
      provider !== "lastfm"
    ) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Fetch tracks from the platform
    let tracks: { title: string; artist: string }[];

    if (provider === "lastfm") {
      if (!lastfmUsername) {
        return NextResponse.json(
          { error: "Missing lastfmUsername" },
          { status: 400 },
        );
      }

      if (
        typeof lastfmUsername !== "string" ||
        lastfmUsername.length < 2 ||
        lastfmUsername.length > 15 ||
        !/^[a-zA-Z0-9_-]+$/.test(lastfmUsername)
      ) {
        return NextResponse.json(
          { error: "Invalid lastfmUsername" },
          { status: 400 },
        );
      }

      const apiKey = process.env.LASTFM_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Last.fm not configured" },
          { status: 500 },
        );
      }

      if (playlistId === "loved") {
        tracks = await getLovedTracks(apiKey, lastfmUsername);
      } else if (playlistId === "recent") {
        tracks = await getRecentTracks(apiKey, lastfmUsername);
      } else if (playlistId.startsWith("tags:")) {
        const tag = playlistId.slice(5);
        tracks = await getPersonalTagTracks(apiKey, lastfmUsername, tag);
      } else {
        return NextResponse.json(
          { error: "Invalid playlistId for lastfm" },
          { status: 400 },
        );
      }
    } else {
      const accessToken = await getValidAccessToken(authUser.id, provider);
      if (!accessToken) {
        return NextResponse.json(
          { error: "reauth_required", provider },
          { status: 401 },
        );
      }

      if (provider === "spotify") {
        const spotifyTracks =
          playlistId === "liked"
            ? await getLikedTracks(accessToken)
            : await getPlaylistTracks(accessToken, playlistId);
        tracks = spotifyTracks.map((t) => ({
          title: t.title,
          artist: t.artist,
        }));
      } else if (provider === "google") {
        tracks = await getPlaylistItems(accessToken, playlistId);
      } else {
        const developerToken = generateAppleMusicDeveloperToken();
        tracks = await getAppleMusicPlaylistTracks(
          developerToken,
          accessToken,
          playlistId,
        );
      }
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
    return NextResponse.json(
      { error: "Failed to match playlist" },
      { status: 500 },
    );
  }
}
