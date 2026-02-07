"use client";

import { useTranslations } from "@/hooks/use-translations";

export default function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-primary/20 py-4 sm:py-6 mt-8 sm:mt-12 relative z-10">
      <div className="container mx-auto px-2 sm:px-4 text-center text-xs sm:text-sm text-muted-foreground">
        <p>{t("footer.text")}</p>
        <p className="mt-2 text-[10px] sm:text-xs opacity-70">
          {t("footer.disclaimer")}
        </p>
      </div>
    </footer>
  );
}
