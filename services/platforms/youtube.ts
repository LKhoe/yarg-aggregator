import type { PlatformLink } from "@/types";

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

export async function searchYouTube(
  song: string,
  artist: string,
): Promise<PlatformLink | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const query = `${song} ${artist}`.trim();
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as YouTubeSearchResponse;
  const item = json.items?.[0];
  if (!item) return null;

  return {
    platform: "youtube",
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    previewUrl: null,
    videoId: item.id.videoId,
  };
}
