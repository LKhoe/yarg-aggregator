"use client";

import { useTranslations } from "@/hooks/use-translations";
import { useCountUp } from "@/hooks/use-count-up";

interface HeroProps {
  totalSongs: number;
}

export default function Hero({ totalSongs }: HeroProps) {
  const { t } = useTranslations();
  const animatedCount = useCountUp(totalSongs);

  return (
    <div className="relative overflow-hidden rounded-xl p-6 sm:p-10 border border-primary/20 ring-1 ring-inset dark:ring-white/5 ring-black/5" style={{ background: "radial-gradient(ellipse at 20% 30%, oklch(0.65 0.25 280 / 0.15), transparent 60%), radial-gradient(ellipse at 80% 70%, oklch(0.55 0.22 200 / 0.1), transparent 60%), var(--card)" }}>
      <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent" />
      <div className="relative">
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent opacity-0"
          style={{ animation: "fade-slide-up 0.5s ease-out forwards" }}
        >
          {t("welcome.title")}
          {totalSongs > 0 && (
            <span
              className="text-xs sm:text-sm font-medium tabular-nums tracking-wide bg-primary/15 text-primary dark:text-primary-foreground dark:bg-primary/30 rounded-full px-2.5 py-0.5 ml-2 inline-block opacity-0 align-middle"
              style={{ animation: "fade-slide-up 0.5s ease-out 0.1s forwards" }}
            >
              {animatedCount.toLocaleString()} {t("welcome.songsCount")}
            </span>
          )}
        </h2>
        <p
          className="text-sm sm:text-base text-muted-foreground opacity-0"
          style={{ animation: "fade-slide-up 0.5s ease-out 0.2s forwards" }}
        >
          {t("welcome.description")}
        </p>
      </div>
    </div>
  );
}
