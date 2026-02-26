"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/use-translations";
import { Play, Pause, Volume2, VolumeX, ExternalLink, Loader2 } from "lucide-react";

interface YouTubeEmbedProps {
  videoId: string;
  url: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Singleton promise so the script is injected only once
let ytApiReady: Promise<void> | null = null;

function loadYTApi(): Promise<void> {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return ytApiReady;
}

export default function YouTubeEmbed({ videoId, url }: YouTubeEmbedProps) {
  const { t } = useTranslations();
  const uid = useId();
  const containerId = `yt-player-${uid.replace(/:/g, "")}`;

  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const stopTicker = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    intervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setCurrentTime(p.getCurrentTime());
    }, 250);
  }, [stopTicker]);

  useEffect(() => {
    let destroyed = false;

    loadYTApi().then(() => {
      if (destroyed) return;

      const player = new YT.Player(containerId, {
        height: "0",
        width: "0",
        videoId,
        playerVars: { autoplay: 1, controls: 0 },
        events: {
          onReady(e) {
            if (destroyed) return;
            playerRef.current = e.target;
            setDuration(e.target.getDuration());
            setReady(true);
            startTicker();
            setPlaying(true);
          },
          onStateChange(e) {
            if (destroyed) return;
            const state = e.data;
            if (state === YT.PlayerState.PLAYING) {
              setPlaying(true);
              startTicker();
            } else if (
              state === YT.PlayerState.PAUSED ||
              state === YT.PlayerState.ENDED
            ) {
              setPlaying(false);
              stopTicker();
              if (state === YT.PlayerState.ENDED) setCurrentTime(0);
            }
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      stopTicker();
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore if already destroyed
      }
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }, [muted]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const p = playerRef.current;
      if (!p || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const target = ratio * duration;
      p.seekTo(target, true);
      setCurrentTime(target);
    },
    [duration],
  );

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Hidden YT player mount point */}
      <div id={containerId} style={{ display: "none" }} />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={togglePlay}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
        >
          {!ready ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div
          className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer relative"
          onClick={seek}
          onKeyDown={(e) => {
            if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && playerRef.current && duration) {
              const delta = e.key === "ArrowRight" ? 5 : -5;
              const next = Math.max(0, Math.min(duration, currentTime + delta));
              playerRef.current.seekTo(next, true);
              setCurrentTime(next);
            }
          }}
          role="slider"
          tabIndex={0}
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(to right, var(--color-primary), var(--color-chart-2))",
              boxShadow:
                "0 0 4px 1px oklch(from var(--color-primary) l c h / 60%), 0 0 12px 2px oklch(from var(--color-chart-2) l c h / 30%)",
            }}
          />
        </div>

        <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
          {formatTime(currentTime)}
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleMute}
          disabled={!ready}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        asChild
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3 w-3 mr-1" />
          {t("songDetail.openIn", { platform: "YouTube" })}
        </a>
      </Button>
    </div>
  );
}
