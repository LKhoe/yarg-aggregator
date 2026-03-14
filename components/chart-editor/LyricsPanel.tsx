"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ChartData, LyricEvent, TrackKey } from "@/lib/chart/types";
import { parseTrackKey } from "@/lib/chart/types";
import { buildTempoMap } from "@/lib/chart/tempo-utils";
import {
  parsePlainText,
  parseLrc,
  autoAssignSyllables,
  getActiveLyricIndex,
} from "@/lib/chart/lyrics-utils";

export interface LyricsPanelProps {
  chart: ChartData;
  trackKey: TrackKey;
  currentTick: number;
  isPlaying: boolean;
  onUpdateLyrics: (lyrics: LyricEvent[]) => void;
}

export const LyricsPanel = memo(function LyricsPanel({
  chart,
  trackKey,
  currentTick,
  isPlaying,
  onUpdateLyrics,
}: LyricsPanelProps) {
  const [rawText, setRawText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tapMode, setTapMode] = useState(false);
  const [tapIndex, setTapIndex] = useState(0);
  const tapIndexRef = useRef(tapIndex);
  tapIndexRef.current = tapIndex;
  const lyricsRef = useRef(chart.lyrics);
  lyricsRef.current = chart.lyrics;
  const currentTickRef = useRef(currentTick);
  currentTickRef.current = currentTick;
  const onUpdateRef = useRef(onUpdateLyrics);
  onUpdateRef.current = onUpdateLyrics;

  const lyrics = chart.lyrics;
  const parsed = parseTrackKey(trackKey);
  const trackNotes = parsed ? (chart.tracks[trackKey]?.notes ?? []) : [];

  // Active lyric index for highlight during playback
  const activeLyricIdx = isPlaying ? getActiveLyricIndex(lyrics, currentTick) : -1;

  // Scroll active lyric into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeLyricIdx < 0 || !listRef.current) return;
    const item = listRef.current.children[activeLyricIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLyricIdx]);

  // Tap sync keyboard handler
  useEffect(() => {
    if (!tapMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const idx = tapIndexRef.current;
      const current = lyricsRef.current;
      if (idx >= current.length) {
        setTapMode(false);
        return;
      }
      const updated = current.map((l, i) =>
        i === idx ? { ...l, tick: Math.round(currentTickRef.current) } : l
      );
      onUpdateRef.current(updated);
      setTapIndex(idx + 1);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [tapMode]);

  const handleFetch = useCallback(async () => {
    const { artist, name } = chart.metadata;
    if (!artist || !name) {
      setFetchError("Chart has no artist/title metadata");
      return;
    }
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/music/lyrics?song=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setFetchError((json as { error?: string }).error ?? "Not found");
        return;
      }
      const json = await res.json() as { lyrics: string; syncedLyrics?: string; source: string };
      const text = json.syncedLyrics ?? json.lyrics;
      setRawText(text);
      // Auto-parse immediately
      const tempoMap = buildTempoMap(chart);
      const isLrc = json.syncedLyrics != null;
      const parsed = isLrc ? parseLrc(text, tempoMap) : parsePlainText(text);
      onUpdateLyrics(parsed);
      setTapIndex(0);
    } catch {
      setFetchError("Network error");
    } finally {
      setFetching(false);
    }
  }, [chart, onUpdateLyrics]);

  const handleParseLyrics = useCallback(() => {
    if (!rawText.trim()) return;
    const tempoMap = buildTempoMap(chart);
    const isLrc = /^\[\d{1,2}:\d{2}[.:]\d{2,3}\]/.test(rawText.trim());
    const parsed = isLrc ? parseLrc(rawText, tempoMap) : parsePlainText(rawText);
    onUpdateLyrics(parsed);
    setTapIndex(0);
  }, [rawText, chart, onUpdateLyrics]);

  const handleAutoAssign = useCallback(() => {
    const sorted = [...trackNotes].sort((a, b) => a.tick - b.tick);
    onUpdateLyrics(autoAssignSyllables(lyrics, sorted));
  }, [lyrics, trackNotes, onUpdateLyrics]);

  const handleClear = useCallback(() => {
    onUpdateLyrics([]);
    setRawText("");
    setTapIndex(0);
    setTapMode(false);
  }, [onUpdateLyrics]);

  const handleUpdateText = useCallback((id: string, text: string) => {
    onUpdateLyrics(lyrics.map((l) => (l.id === id ? { ...l, text } : l)));
  }, [lyrics, onUpdateLyrics]);

  const handleUpdateTick = useCallback((id: string, tick: number | null) => {
    onUpdateLyrics(lyrics.map((l) => (l.id === id ? { ...l, tick } : l)));
  }, [lyrics, onUpdateLyrics]);

  const handleRemove = useCallback((id: string) => {
    onUpdateLyrics(lyrics.filter((l) => l.id !== id));
  }, [lyrics, onUpdateLyrics]);

  const assigned = lyrics.filter((l) => l.tick !== null).length;

  return (
    <div className="border-t p-3 flex flex-col gap-3 min-w-[200px] max-w-[240px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Lyrics</h3>
        {lyrics.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {assigned}/{lyrics.length} synced
          </span>
        )}
      </div>

      {/* Fetch from LRCLIB */}
      <div className="space-y-1">
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs"
          onClick={handleFetch}
          disabled={fetching || !chart.metadata.artist || !chart.metadata.name}
          title={
            !chart.metadata.artist || !chart.metadata.name
              ? "Chart metadata has no artist/title"
              : "Fetch synced lyrics from LRCLIB"
          }
        >
          {fetching ? "Fetching…" : "Fetch from LRCLIB"}
        </Button>
        {fetchError && (
          <p className="text-[10px] text-destructive">{fetchError}</p>
        )}
      </div>

      {/* Text input */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Paste lyrics or LRC</Label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={"Plain text or [mm:ss.xx] LRC…"}
          rows={4}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" className="w-full h-7 text-xs" onClick={handleParseLyrics} disabled={!rawText.trim()}>
          Parse
        </Button>
      </div>

      {/* Syllable list */}
      {lyrics.length > 0 && (
        <>
          <div
            ref={listRef}
            className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto pr-0.5"
          >
            {lyrics.map((lyric, i) => (
              <div
                key={lyric.id}
                className={cn(
                  "flex items-center gap-1 rounded px-1 py-0.5 text-xs",
                  i === activeLyricIdx && "bg-pink-500/20 ring-1 ring-pink-500/40",
                  tapMode && i === tapIndex && "bg-yellow-500/20 ring-1 ring-yellow-500/40"
                )}
              >
                <input
                  className="min-w-0 flex-1 bg-transparent focus:outline-none"
                  value={lyric.text}
                  onChange={(e) => handleUpdateText(lyric.id, e.target.value)}
                />
                <input
                  type="number"
                  className="w-[52px] bg-transparent text-right text-muted-foreground focus:outline-none focus:text-foreground"
                  value={lyric.tick ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value;
                    handleUpdateTick(lyric.id, v === "" ? null : Math.max(0, parseInt(v, 10)));
                  }}
                />
                <button
                  className="text-muted-foreground hover:text-destructive leading-none"
                  onClick={() => handleRemove(lyric.id)}
                  tabIndex={-1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={handleAutoAssign}
              disabled={trackNotes.length === 0}
              title={trackNotes.length === 0 ? "No notes in this track" : "Assign unsynced syllables to note positions"}
            >
              Auto-assign
            </Button>
            <Button
              size="sm"
              variant={tapMode ? "destructive" : "outline"}
              className="w-full h-7 text-xs"
              onClick={() => {
                setTapMode((v) => !v);
                setTapIndex(0);
              }}
            >
              {tapMode ? `Tap sync (${tapIndex}/${lyrics.length}) — Esc` : "Tap sync"}
            </Button>
            {tapMode && (
              <p className="text-[10px] text-muted-foreground text-center">
                Press Space or Enter to stamp next syllable
              </p>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={handleClear}
            >
              Clear all
            </Button>
          </div>
        </>
      )}
    </div>
  );
});
