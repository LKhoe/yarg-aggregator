"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, Loader2 } from "lucide-react";

interface SongLyricsProps {
  songName: string;
  artistName: string;
}

export default function SongLyrics({ songName, artistName }: SongLyricsProps) {
  const t = useTranslations("songLyrics");
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Reset state when song changes
  useEffect(() => {
    setOpen(false);
    setLyrics(null);
    setSource(null);
    setLoading(false);
    setError(null);
    setFetched(false);
  }, [songName, artistName]);

  const fetchLyrics = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    setError(null);
    setFetched(true);

    try {
      const params = new URLSearchParams({
        song: songName,
        artist: artistName,
      });
      const res = await fetch(`/api/music/lyrics?${params}`);

      if (!res.ok) {
        setError(t("notFound"));
        return;
      }

      const json = await res.json();
      setLyrics(json.lyrics);
      setSource(json.source);
    } catch {
      setError(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [songName, artistName, fetched, t]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && !fetched) {
        fetchLyrics();
      }
    },
    [fetched, fetchLyrics],
  );

  if (!isAuthenticated) return null;

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {t("title")}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <p className="text-xs text-muted-foreground">{error}</p>
          )}
          {lyrics && (
            <>
              <div className="max-h-64 overflow-y-auto">
                <p className="text-xs leading-relaxed whitespace-pre-line">
                  {lyrics}
                </p>
              </div>
              {source && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {t("source", { source })}
                </p>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
