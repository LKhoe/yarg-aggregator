"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { useTranslations } from "@/hooks/use-translations";
import { toast } from "sonner";
import Link from "next/link";
import { SocialProviderButton } from "@/components/auth/SocialProviderButton";

export function LoginForm() {
  const { t } = useTranslations();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isLastfmLoading, setIsLastfmLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch {
      toast.error(t("auth.errors.generic"));
      setIsGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsAppleLoading(true);

    try {
      await signIn.social({
        provider: "apple",
        callbackURL: "/",
      });
    } catch {
      toast.error(t("auth.errors.generic"));
      setIsAppleLoading(false);
    }
  };

  const handleSpotifyLogin = async () => {
    setIsSpotifyLoading(true);

    try {
      await signIn.social({
        provider: "spotify",
        callbackURL: "/",
      });
    } catch {
      toast.error(t("auth.errors.generic"));
      setIsSpotifyLoading(false);
    }
  };

  const handleLastfmLogin = () => {
    setIsLastfmLoading(true);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- API route that redirects to Last.fm; needs a full page load, not client routing
    window.location.href = "/api/auth/lastfm/signin";
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("auth.login.subtitle")}</p>
      </div>

      <div className="flex justify-center gap-3">
        <SocialProviderButton
          logos={[
            { src: "/social-providers/google.svg", alt: "Google" },
            // {
            //   src: "/social-providers/youtube-music.svg",
            //   alt: "YouTube Music",
            // },
          ]}
          label={t("auth.login.googleButton")}
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          isLoading={isGoogleLoading}
        />
        <SocialProviderButton
          logos={[{ src: "/social-providers/spotify.svg", alt: "Spotify" }]}
          label={t("auth.login.spotifyButton")}
          onClick={handleSpotifyLogin}
          disabled={isSpotifyLoading}
          isLoading={isSpotifyLoading}
        />
        <SocialProviderButton
          logos={[
            { src: "/social-providers/apple.svg", alt: "Apple" },
            // { src: "/social-providers/apple-music.svg", alt: "Apple Music" },
          ]}
          label={t("auth.login.appleButton")}
          onClick={handleAppleLogin}
          disabled={isAppleLoading}
          isLoading={isAppleLoading}
          invertOnDark
        />
        <SocialProviderButton
          logos={[{ src: "/social-providers/lastfm.svg", alt: "Last.fm" }]}
          label={t("auth.login.lastfmButton")}
          onClick={handleLastfmLogin}
          disabled={isLastfmLoading}
          isLoading={isLastfmLoading}
        />
      </div>

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/60">
        <Link href="/privacy" className="hover:text-muted-foreground transition-colors">
          {t("footer.privacyPolicy")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="hover:text-muted-foreground transition-colors">
          {t("footer.termsOfService")}
        </Link>
      </div>
    </div>
  );
}
