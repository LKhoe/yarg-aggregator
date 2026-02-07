import type { PlatformLink } from "@/types";

interface DeezerTrack {
  id: number;
  title: string;
  link: string;
  preview: string;
  artist: { name: string };
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
}

export async function searchDeezer(
  song: string,
  artist: string,
): Promise<PlatformLink | null> {
  const query = `${song} ${artist}`.trim();
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as DeezerSearchResponse;
  const track = json.data?.[0];
  if (!track) return null;

  return {
    platform: "deezer",
    url: track.link,
    previewUrl: track.preview || null,
    videoId: null,
  };
}
