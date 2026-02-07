"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/use-translations";
import { ExternalLink } from "lucide-react";

interface YouTubeEmbedProps {
  videoId: string;
  url: string;
}

export default function YouTubeEmbed({ videoId, url }: YouTubeEmbedProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-2">
      <div className="rounded-lg overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full"
          style={{ height: 160 }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="YouTube video"
        />
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
