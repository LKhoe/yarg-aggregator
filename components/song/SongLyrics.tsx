"use client";

import { useReducer, useCallback } from "react";
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

type State = {
  open: boolean;
  lyrics: string | null;
  source: string | null;
  loading: boolean;
  error: string | null;
  fetched: boolean;
};

type Action =
  | { type: "open"; payload: boolean }
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: { lyrics: string; source: string } }
  | { type: "fetch_error"; payload: string };

const initialState: State = {
  open: false,
  lyrics: null,
  source: null,
  loading: false,
  error: null,
  fetched: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { ...state, open: action.payload };
    case "fetch_start":
      return { ...state, loading: true, error: null, fetched: true };
    case "fetch_success":
      return { ...state, loading: false, lyrics: action.payload.lyrics, source: action.payload.source };
    case "fetch_error":
      return { ...state, loading: false, error: action.payload };
  }
}

export default function SongLyrics({ songName, artistName }: SongLyricsProps) {
  const t = useTranslations("songLyrics");
  const { isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { open, lyrics, source, loading, error, fetched } = state;

  const fetchLyrics = useCallback(async () => {
    if (fetched) return;
    dispatch({ type: "fetch_start" });

    try {
      const params = new URLSearchParams({
        song: songName,
        artist: artistName,
      });
      const res = await fetch(`/api/music/lyrics?${params}`);

      if (!res.ok) {
        dispatch({ type: "fetch_error", payload: t("notFound") });
        return;
      }

      const json = await res.json();
      dispatch({ type: "fetch_success", payload: { lyrics: json.lyrics, source: json.source } });
    } catch {
      dispatch({ type: "fetch_error", payload: t("fetchError") });
    }
  }, [songName, artistName, fetched, t]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      dispatch({ type: "open", payload: isOpen });
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
