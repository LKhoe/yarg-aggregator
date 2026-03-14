import { NextRequest, NextResponse } from "next/server";
import he from "he";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function fetchFromLyricsOvh(
  artist: string,
  song: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.lyrics?.replace(/\n{2}/g, "\n").trim() || null;
  } catch {
    return null;
  }
}

async function fetchFromLrcLib(
  artist: string,
  song: string,
): Promise<{ plain: string; synced?: string } | null> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const hit = json?.[0];
    if (!hit?.plainLyrics) return null;
    return {
      plain: hit.plainLyrics.trim(),
      synced: hit.syncedLyrics?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchFromVagalume(
  artist: string,
  song: string,
): Promise<string | null> {
  try {
    const url = `https://www.vagalume.com.br/${slugify(artist)}/${slugify(song)}.html`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/<div[^>]*id="lyrics"[^>]*>([\s\S]*?)<\/div>/i);
    if (!match) return null;

    const raw = match[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");

    return he.decode(raw).trim() || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const song = searchParams.get("song")?.trim();
  const artist = searchParams.get("artist")?.trim();

  if (!song || !artist) {
    return NextResponse.json(
      { error: "song and artist are required" },
      { status: 400 },
    );
  }

  const ovhResult = await fetchFromLyricsOvh(artist, song);
  if (ovhResult) {
    return NextResponse.json({ lyrics: ovhResult, source: "lyrics.ovh" });
  }

  const lrcResult = await fetchFromLrcLib(artist, song);
  if (lrcResult) {
    return NextResponse.json({
      lyrics: lrcResult.plain,
      syncedLyrics: lrcResult.synced,
      source: "lrclib.net",
    });
  }

  const vagalumeResult = await fetchFromVagalume(artist, song);
  if (vagalumeResult) {
    return NextResponse.json({
      lyrics: vagalumeResult,
      source: "vagalume.com.br",
    });
  }

  return NextResponse.json({ error: "Lyrics not found" }, { status: 404 });
}
