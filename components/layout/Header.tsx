"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { UserMenu } from "@/components/auth/UserMenu";
import { useTranslations } from "@/hooks/use-translations";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  const { t, locale, changeLanguage } = useTranslations();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gradient-h bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br from-primary via-accent to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
            {/*<Music className="h-4 w-4 sm:h-6 sm:w-6" />*/}
            <Image
              src="/logo-simple.svg"
              alt="YargAggregator"
              className="h-10 w-10"
              preload={true}
              width={40}
              height={40}
            />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="hidden sm:block text-lg sm:text-xl font-bold tracking-[-0.03em] bg-linear-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                {t("app.name")}
              </h1>
              <span className="text-xs text-muted-foreground/60 font-mono">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden lg:block">
              {t("app.subtitle")}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher
            currentLocale={locale}
            onLanguageChange={changeLanguage}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
