import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import {
  getValidAccessToken,
  generateAppleMusicDeveloperToken,
} from "@/lib/services/platform-auth";
import { getUserPlaylists as getSpotifyPlaylists } from "@/services/platforms/spotify-user";
import { getUserPlaylists as getYouTubePlaylists } from "@/services/platforms/youtube-user";
import { getUserPlaylists as getAppleMusicPlaylists } from "@/services/platforms/apple-music-user";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "spotify" && provider !== "google" && provider !== "apple") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(authUser.id, provider);
    if (!accessToken) {
      return NextResponse.json(
        { error: "reauth_required", provider },
        { status: 401 },
      );
    }

    if (provider === "spotify") {
      const playlists = await getSpotifyPlaylists(accessToken);
      return NextResponse.json(playlists);
    } else if (provider === "google") {
      const playlists = await getYouTubePlaylists(accessToken);
      return NextResponse.json(playlists);
    } else {
      const developerToken = generateAppleMusicDeveloperToken();
      const playlists = await getAppleMusicPlaylists(
        developerToken,
        accessToken,
      );
      return NextResponse.json(playlists);
    }
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 },
    );
  }
}
