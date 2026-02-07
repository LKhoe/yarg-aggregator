import type { PlatformLink } from "@/types";

interface SoundCloudTrack {
  id: number;
  title: string;
  permalink_url: string;
}

interface SoundCloudSearchResponse {
  collection: SoundCloudTrack[];
}

export async function searchSoundCloud(
  song: string,
  artist: string,
): Promise<PlatformLink | null> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) return null;

  const query = `${song} ${artist}`.trim();
  const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=1`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as SoundCloudSearchResponse;
  const track = json.collection?.[0];
  if (!track) return null;

  return {
    platform: "soundcloud",
    url: track.permalink_url,
    previewUrl: null,
    videoId: null,
  };
}
