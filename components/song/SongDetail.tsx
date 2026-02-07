"use client";

import type { ProviderMusic } from "@/types";
import { useTranslations } from "@/hooks/use-translations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyMedal } from "@/components/ui/difficulty-medal";
import { InstrumentIcon } from "@/components/ui/instrument-icon";
import {
  X,
  Download,
  Music,
  Calendar,
  User,
  CheckCircle,
  Heart,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import PlatformLinks from "./PlatformLinks";
import SongLyrics from "./SongLyrics";

const INSTRUMENTS = ["guitar", "bass", "drums", "vocals", "keys"] as const;

interface SongDetailProps {
  song: ProviderMusic | null;
  onClose: () => void;
}

export default function SongDetail({ song, onClose }: SongDetailProps) {
  const { t } = useTranslations();

  if (!song) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t("songDetail.title")}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cover + Title */}
        <div className="flex gap-3">
          <div className="relative h-20 w-20 rounded-lg overflow-hidden shrink-0">
            {song.coverUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={song.coverUrl}
                  alt={song.name}
                  className="h-full w-full object-cover bg-muted"
                  style={{ display: "none" }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      const skeleton = parent.querySelector(".loading-skeleton");
                      const fallback = parent.querySelector(".error-fallback");
                      if (skeleton) {
                        (skeleton as HTMLElement).style.display = "none";
                      }
                      if (fallback) {
                        (fallback as HTMLElement).style.display = "flex";
                      }
                    }
                  }}
                  onLoad={(e) => {
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      const skeleton = parent.querySelector(".loading-skeleton");
                      const fallback = parent.querySelector(".error-fallback");
                      if (skeleton) {
                        (skeleton as HTMLElement).style.display = "none";
                      }
                      if (fallback) {
                        (fallback as HTMLElement).style.display = "none";
                      }
                    }
                    target.style.display = "block";
                  }}
                />
                {/* Loading skeleton - shown while image is loading */}
                <div className="loading-skeleton absolute inset-0">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
                {/* Error fallback - shown only on error */}
                <div
                  className="error-fallback absolute inset-0 bg-muted flex items-center justify-center rounded-lg"
                  style={{ display: "none" }}
                >
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
              </>
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <Music className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              className={`font-semibold text-sm leading-tight truncate ${song.installed ? "text-green-600 dark:text-green-400" : ""}`}
            >
              {song.installed && (
                <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
              )}
              {song.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {song.artist}
            </p>
            {song.album && (
              <p className="text-xs text-muted-foreground truncate">
                {song.album}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-1.5">
          {song.genre && (
            <Badge variant="secondary" className="text-xs">
              {song.genre}
            </Badge>
          )}
          {song.year && (
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {song.year}
            </Badge>
          )}
          {song.charter && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {song.charter}
            </Badge>
          )}
          {song.installed && (
            <Badge
              variant="default"
              className="text-xs bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {t("songDetail.installed")}
            </Badge>
          )}
          {song.favorited && (
            <Badge
              variant="default"
              className="text-xs bg-red-500 hover:bg-red-600"
            >
              <Heart className="h-3 w-3 mr-1" />
              {t("songDetail.favorited")}
            </Badge>
          )}
        </div>

        {/* Instruments */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("songDetail.instruments")}
          </p>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((inst) => {
              const diff = song.instruments[inst];
              if (diff === null) return null;
              return (
                <div
                  key={inst}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <DifficultyMedal
                    level={diff}
                    size="sm"
                    icon={<InstrumentIcon instrument={inst} />}
                  />
                  <div className="flex flex-col">
                    <span className="capitalize font-medium">
                      {t(`table.instrumentsObj.${inst}` as any)}
                    </span>
                    <span className="text-muted-foreground">
                      {diff}/7
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Download Links */}
        {song.downloadUrls && song.downloadUrls.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
              {t("songDetail.downloads")}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-1.5 mt-2">
                {song.downloadUrls.map((dl, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    asChild
                  >
                    <a
                      href={dl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      {dl.source}
                    </a>
                  </Button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Platform Links */}
        <PlatformLinks songName={song.name} artistName={song.artist} />

        {/* Lyrics */}
        <SongLyrics songName={song.name} artistName={song.artist} />
      </CardContent>
    </Card>
  );
}
