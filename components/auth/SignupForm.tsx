"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/hooks/use-translations";
import { toast } from "sonner";
import Link from "next/link";

export function SignupForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("auth.errors.passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      toast.error(t("auth.errors.passwordTooShort"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        if (result.error.message?.includes("already exists")) {
          toast.error(t("auth.errors.emailExists"));
        } else {
          toast.error(t("auth.errors.generic"));
        }
      } else {
        // Check if email verification is required
        try {
          const configResponse = await fetch("/api/auth/config");
          const config = await configResponse.json();

          if (config.requireEmailVerification) {
            toast.success(t("auth.signup.checkEmail"));
            router.push("/verify-email");
          } else {
            // Try to sign in the user immediately
            const signInResult = await signIn.email({
              email,
              password,
              callbackURL: "/",
            });

            if (signInResult.error) {
              // If auto sign-in fails, redirect to login
              toast.success(t("auth.signup.success"));
              router.push("/login");
            } else {
              // User is signed in, redirect to main page
              toast.success(t("auth.signup.success"));
              router.push("/");
            }
          }
        } catch (configError) {
          // Fallback: if we can't check config, assume verification is not required
          console.error("Error checking auth config:", configError);
          toast.success(t("auth.signup.success"));
          router.push("/login");
        }
      }
    } catch {
      toast.error(t("auth.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
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

  const handleSpotifySignup = async () => {
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
        <h1 className="text-2xl font-bold">{t("auth.signup.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("auth.signup.subtitle")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleGoogleSignup}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <span className="animate-spin mr-2">⏳</span>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {t("auth.signup.googleButton")}
        </Button>

        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSpotifySignup}
          disabled={isSpotifyLoading}
        >
          {isSpotifyLoading ? (
            <span className="animate-spin mr-2">⏳</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          )}
          {t("auth.signup.spotifyButton")}
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.signup.orContinueWith")}
          </span>
        </div>
      </div>

      <form onSubmit={handleEmailSignup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.signup.name")}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t("auth.signup.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.signup.email")}</Label>
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
          <Label htmlFor="password">{t("auth.signup.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">
            {t("auth.signup.passwordRequirement")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            {t("auth.signup.confirmPassword")}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("auth.signup.loading") : t("auth.signup.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.signup.haveAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("auth.signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
