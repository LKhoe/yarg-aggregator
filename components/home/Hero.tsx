"use client";

import { useTranslations } from "@/hooks/use-translations";

interface HeroProps {
  totalSongs: number;
}

export default function Hero({ totalSongs }: HeroProps) {
  const { t } = useTranslations();

  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-primary/20 via-accent/10 to-primary/5 p-4 sm:p-6 border border-primary/20">
      <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent" />
      <div className="relative">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t("welcome.title")}
          {totalSongs > 0 && (
            <span className="text-sm sm:text-base font-normal text-muted-foreground ml-2">
              ({totalSongs.toLocaleString()} {t("welcome.songsCount")})
            </span>
          )}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("welcome.description")}
        </p>
      </div>
    </div>
  );
}
