"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/hooks/use-translations";
import { toast } from "sonner";
import Link from "next/link";
import { SocialProviderButton } from "@/components/auth/SocialProviderButton";

export function LoginForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isLastfmLoading, setIsLastfmLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        toast.error(t("auth.errors.invalidCredentials"));
      } else {
        toast.success(t("auth.login.success"));
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error(t("auth.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.login.orContinueWith")}
          </span>
        </div>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.login.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.login.password")}</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("auth.login.loading") : t("auth.login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.login.noAccount")}{" "}
        <Link href="/signup" className="text-primary hover:underline">
          {t("auth.login.signUp")}
        </Link>
      </p>
    </div>
  );
}
