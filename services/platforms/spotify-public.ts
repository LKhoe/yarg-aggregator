const SPOTIFY_API = "https://api.spotify.com/v1";

export interface SpotifyPublicTrackInfo {
  title: string;
  artist: string;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyPaginatedResponse<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SpotifyPlaylistTrackRaw {
  track: {
    name: string;
    artists: { name: string }[];
  } | null;
}

interface SpotifyPlaylistMetaRaw {
  name: string;
}

export async function getClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`Spotify token error: ${response.status}`);
  }
  const data = (await response.json()) as SpotifyTokenResponse;
  return data.access_token;
}

export function parseSpotifyPlaylistId(url: string): string | null {
  const match = url.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export async function getPublicPlaylistTracks(
  url: string,
  clientId: string,
  clientSecret: string,
): Promise<{ tracks: SpotifyPublicTrackInfo[]; playlistName: string }> {
  const playlistId = parseSpotifyPlaylistId(url);
  if (!playlistId) {
    throw new Error("Invalid Spotify playlist URL");
  }

  const accessToken = await getClientCredentialsToken(clientId, clientSecret);

  // Fetch playlist metadata for the name
  const metaResponse = await fetch(`${SPOTIFY_API}/playlists/${playlistId}?fields=name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Spotify API error: ${metaResponse.status}`);
  }
  const meta = (await metaResponse.json()) as SpotifyPlaylistMetaRaw;
  const playlistName = meta.name;

  // Paginate tracks
  const tracks: SpotifyPublicTrackInfo[] = [];
  let nextUrl: string | null =
    `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists(name))),next`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    const data = (await response.json()) as SpotifyPaginatedResponse<SpotifyPlaylistTrackRaw>;

    for (const item of data.items) {
      if (!item.track) continue;
      tracks.push({
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
      });
    }

    nextUrl = data.next;
  }

  return { tracks, playlistName };
}
