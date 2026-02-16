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

export function LoginForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);

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

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("auth.login.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <span className="animate-spin mr-2">⏳</span>
          ) : (
            <svg viewBox="0 0 176 176">
              <circle cx="88" cy="88" r="88" fill="#f00" />
              <circle cx="88" cy="88" r="54" fill="#fff" />
              <circle cx="88" cy="88" r="44" fill="#f00" />
              <path fill="#fff" d="m72 111 39-24-39-22z" />
            </svg>
          )}
          {t("auth.login.youtubeMusicButton")}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleSpotifyLogin}
          disabled={isSpotifyLoading}
        >
          {isSpotifyLoading ? (
            <span className="animate-spin mr-2">⏳</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="#1db954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0m5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02m1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6s.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2m.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3" />
            </svg>
          )}
          {t("auth.login.spotifyButton")}
        </Button>
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
