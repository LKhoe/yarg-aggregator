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
import { SocialProviderButton } from "@/components/auth/SocialProviderButton";

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
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const handleEmailSignup = async (e: React.SubmitEvent) => {
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

  const handleAppleSignup = async () => {
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

      <div className="flex justify-center gap-3">
        <SocialProviderButton
          logos={[
            { src: "/social-providers/google.svg", alt: "Google" },
            // {
            //   src: "/social-providers/youtube-music.svg",
            //   alt: "YouTube Music",
            // },
          ]}
          label={t("auth.signup.googleButton")}
          onClick={handleGoogleSignup}
          disabled={isGoogleLoading}
          isLoading={isGoogleLoading}
        />
        <SocialProviderButton
          logos={[{ src: "/social-providers/spotify.svg", alt: "Spotify" }]}
          label={t("auth.signup.spotifyButton")}
          onClick={handleSpotifySignup}
          disabled={isSpotifyLoading}
          isLoading={isSpotifyLoading}
        />
        <SocialProviderButton
          logos={[
            { src: "/social-providers/apple.svg", alt: "Apple" },
            // { src: "/social-providers/apple-music.svg", alt: "Apple Music" },
          ]}
          label={t("auth.signup.appleButton")}
          onClick={handleAppleSignup}
          disabled={isAppleLoading}
          isLoading={isAppleLoading}
          invertOnDark
        />
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
