"use client";

import Link from "next/link";
import { useTranslations } from "@/hooks/use-translations";

export default function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-gradient-h py-4 sm:py-6 mt-8 sm:mt-12 relative z-10">
      <div className="container mx-auto px-2 sm:px-4 text-center text-xs sm:text-sm text-muted-foreground">
        <p>{t("footer.text")}</p>
        <p className="mt-2 text-[10px] sm:text-xs opacity-70">
          {t("footer.disclaimer")}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] sm:text-xs opacity-60">
          <Link href="/privacy" className="hover:opacity-100 hover:underline transition-opacity">
            {t("footer.privacyPolicy")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:opacity-100 hover:underline transition-opacity">
            {t("footer.termsOfService")}
          </Link>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/LKhoe/yarg-aggregator" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 hover:underline transition-opacity">
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
