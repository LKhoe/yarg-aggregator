import type { PlatformLink } from "@/types";

interface SpotifyToken {
  access_token: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  external_urls: { spotify: string };
}

interface SpotifySearchResponse {
  tracks: { items: SpotifyTrack[] };
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) return null;

  const json = (await response.json()) as SpotifyToken;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

export async function searchSpotify(
  song: string,
  artist: string,
): Promise<PlatformLink | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const query = `track:${song} artist:${artist}`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as SpotifySearchResponse;
  const track = json.tracks?.items?.[0];
  if (!track) return null;

  return {
    platform: "spotify",
    url: track.external_urls.spotify,
    previewUrl: track.preview_url,
    videoId: null,
  };
}
