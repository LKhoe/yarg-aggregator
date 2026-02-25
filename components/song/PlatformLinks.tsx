"use client";

import { useState, useCallback, useRef } from "react";
import type { MusicPlatform, PlatformLink } from "@/types";
import { useTranslations } from "@/hooks/use-translations";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import AudioPreview from "./AudioPreview";
import YouTubeEmbed from "./YouTubeEmbed";

const PLATFORMS: { id: MusicPlatform; label: string; color: string }[] = [
  { id: "deezer", label: "Deezer", color: "hover:text-[#A238FF]" },
  { id: "spotify", label: "Spotify", color: "hover:text-[#1DB954]" },
  { id: "youtube", label: "YouTube", color: "hover:text-[#FF0000]" },
  { id: "soundcloud", label: "SoundCloud", color: "hover:text-[#FF5500]" },
];

const DEEZER_PATH = "M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03h-5.19zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z";
const SPOTIFY_PATH = "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";
const YOUTUBE_PATH = "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
const SOUNDCLOUD_PATH = "M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.049-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.193-1.308-.193-1.332c-.014-.06-.047-.094-.104-.094m1.81-.914c-.074 0-.12.06-.12.135l-.21 2.205.21 2.141c0 .074.046.12.12.12.073 0 .12-.046.12-.12l.24-2.141-.24-2.205c0-.075-.047-.135-.12-.135m.899-.645c-.09 0-.148.075-.148.15l-.193 2.505.193 2.19c0 .09.058.15.148.15.09 0 .15-.06.15-.15l.21-2.19-.225-2.505c0-.075-.06-.15-.135-.15m.899-.39c-.105 0-.165.09-.165.165L3.54 14.48l.18 2.22c0 .105.06.165.165.165.09 0 .165-.06.165-.165l.195-2.22-.21-2.591c0-.09-.075-.165-.165-.165m1.08-.585c-.12 0-.194.104-.194.194l-.18 2.79.18 2.235c0 .12.074.194.194.194s.195-.074.195-.194l.194-2.235-.209-2.79c0-.104-.074-.194-.18-.194m.899-.15c-.135 0-.21.105-.21.21l-.165 2.55.165 2.265c0 .135.075.21.21.21.119 0 .21-.075.21-.21l.18-2.265-.194-2.55c0-.105-.076-.21-.196-.21m.9-.135c-.15 0-.24.12-.24.24l-.15 2.4.15 2.28c0 .149.09.239.24.239.149 0 .24-.09.24-.24l.164-2.279-.18-2.4c0-.12-.09-.24-.225-.24m.899.075c-.165 0-.255.135-.255.255l-.15 2.07.15 2.28c0 .164.09.254.255.254.15 0 .255-.09.255-.254l.15-2.28-.165-2.07c0-.12-.09-.255-.24-.255m1.125-.346c-.18 0-.284.15-.284.285l-.103 2.431.118 2.264c.015.165.105.27.27.27s.27-.105.27-.27l.135-2.264-.135-2.431c0-.135-.105-.285-.27-.285m.899.254c-.194 0-.3.164-.3.3l-.09 2.162.09 2.25c.015.18.12.3.3.3.165 0 .3-.12.3-.3l.106-2.25-.106-2.162c0-.149-.12-.3-.3-.3m1.47-1.695c-.105 0-.18.044-.255.119-.06.061-.09.149-.09.24l-.09 3.539.09 2.22c.015.194.15.329.345.329.181 0 .33-.135.345-.329l.105-2.22-.105-3.539c0-.09-.03-.18-.09-.24-.075-.075-.15-.12-.255-.12m.75-.045c-.21 0-.375.165-.375.375l-.075 3.208.075 2.205c.015.21.165.375.375.375a.381.381 0 0 0 .375-.375l.09-2.205-.09-3.208a.381.381 0 0 0-.375-.375m.899-.63c-.074 0-.149.03-.209.09-.075.075-.12.165-.12.27l-.059 3.473.059 2.176c.015.225.165.39.375.39.194 0 .374-.165.374-.39l.075-2.176-.074-3.473c0-.105-.046-.195-.12-.27-.061-.06-.135-.09-.21-.09h-.091m.9-.555c-.075 0-.15.03-.225.09-.09.075-.135.18-.135.3l-.06 3.648.06 2.156c.015.24.18.42.405.42.209 0 .39-.18.405-.42l.06-2.156-.06-3.648c0-.12-.045-.225-.135-.3-.075-.06-.15-.09-.225-.09h-.09m1.2-1.035c-.09 0-.165.03-.24.105a.466.466 0 0 0-.149.33l-.046 4.297.046 2.13c.015.255.194.449.434.449.24 0 .42-.194.435-.449l.06-2.13-.06-4.297a.466.466 0 0 0-.15-.33c-.074-.074-.149-.105-.239-.105h-.09m.899.255c-.255 0-.449.21-.449.465l-.046 3.952.046 2.115c.015.27.21.48.465.48.24 0 .449-.21.464-.48l.046-2.115-.061-3.952c0-.255-.21-.465-.465-.465m1.35-1.02c-.27 0-.494.225-.494.494l-.03 4.477.03 2.085c.015.285.225.51.51.51.27 0 .494-.225.51-.51l.044-2.085-.059-4.477c0-.27-.225-.494-.51-.494m.899.345c-.285 0-.524.24-.524.524l-.015 3.608.015 2.07c.015.3.24.539.539.539.285 0 .524-.24.539-.539l.03-2.07-.03-3.608c0-.285-.24-.524-.54-.524m.899.705c-.3 0-.555.255-.555.555l-.015 2.348.03 2.055c.015.315.255.569.57.569.3 0 .554-.254.569-.569l.03-2.055-.03-2.348c0-.3-.255-.555-.57-.555h-.03m3.855.555c-.42 0-.825.075-1.2.21-.24-2.73-2.55-4.86-5.37-4.86-.675 0-1.32.12-1.92.345-.225.09-.3.18-.3.36v9.54c0 .195.15.36.33.375h8.46a2.79 2.79 0 1 0 0-5.58";

const PLATFORM_PATHS: Record<MusicPlatform, string> = {
  deezer: DEEZER_PATH,
  spotify: SPOTIFY_PATH,
  youtube: YOUTUBE_PATH,
  soundcloud: SOUNDCLOUD_PATH,
};

function PlatformIcon({
  platform,
  className,
}: {
  platform: MusicPlatform;
  className?: string;
}) {
  const size = className || "h-5 w-5";
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
      <path d={PLATFORM_PATHS[platform]} />
    </svg>
  );
}

interface PlatformLinksProps {
  songName: string;
  artistName: string;
}

export default function PlatformLinks({
  songName,
  artistName,
}: PlatformLinksProps) {
  const { t } = useTranslations();
  const { isAuthenticated } = useAuth();
  const [activePlatform, setActivePlatform] = useState<MusicPlatform | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlatformLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activePlatformRef = useRef(activePlatform);
  activePlatformRef.current = activePlatform;

  const handleClick = useCallback(
    async (platform: MusicPlatform) => {
      // Toggle off if same platform
      if (activePlatformRef.current === platform) {
        setActivePlatform(null);
        setResult(null);
        setError(null);
        return;
      }

      setActivePlatform(platform);
      setResult(null);
      setError(null);
      setLoading(true);

      try {
        const params = new URLSearchParams({
          song: songName,
          artist: artistName,
          platform,
        });
        const res = await fetch(`/api/music/platforms?${params}`);
        const json = await res.json();

        if (res.status === 401) {
          setError(t("songDetail.unauthorized"));
          return;
        }

        if (!res.ok) {
          setError(t("songDetail.noResult", { platform }));
          return;
        }

        if (json.configured === false) {
          setError(t("songDetail.notConfigured", { platform }));
          return;
        }

        if (!json.result) {
          setError(t("songDetail.noResult", { platform }));
          return;
        }

        // SoundCloud: open externally
        if (platform === "soundcloud") {
          window.open(json.result.url, "_blank", "noopener,noreferrer");
          setActivePlatform(null);
          return;
        }

        setResult(json.result);
      } catch {
        setError(t("songDetail.noResult", { platform }));
      } finally {
        setLoading(false);
      }
    },
    [songName, artistName, t],
  );

  const platformLabel =
    PLATFORMS.find((p) => p.id === activePlatform)?.label ?? "";

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("songDetail.listenOn")}
      </p>

      <div className="flex gap-1">
        {PLATFORMS.map((p) => {
          const isActive = activePlatform === p.id;
          const isLoading = loading && isActive;
          return (
            <Button
              key={p.id}
              variant={isActive ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => handleClick(p.id)}
              disabled={loading && !isActive}
              title={p.label}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlatformIcon
                  platform={p.id}
                  className={`h-4 w-4 ${isActive ? "" : p.color}`}
                />
              )}
            </Button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-muted-foreground">{error}</p>
      )}

      {result && result.platform === "youtube" && result.videoId && (
        <YouTubeEmbed videoId={result.videoId} url={result.url} />
      )}

      {result &&
        (result.platform === "deezer" || result.platform === "spotify") &&
        result.previewUrl && (
          <AudioPreview
            previewUrl={result.previewUrl}
            platformUrl={result.url}
            platformName={platformLabel}
          />
        )}

      {result &&
        (result.platform === "deezer" || result.platform === "spotify") &&
        !result.previewUrl && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("songDetail.noPreview")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              asChild
            >
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("songDetail.openIn", { platform: platformLabel })}
              </a>
            </Button>
          </div>
        )}
    </div>
  );
}
