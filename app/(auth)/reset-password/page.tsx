"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

function ResetPasswordContent() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const token = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("auth.errors.passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      toast.error(t("auth.errors.passwordTooShort"));
      return;
    }

    if (!token) {
      toast.error(t("auth.resetPassword.invalidToken"));
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({
        newPassword: password,
        token,
      });
      toast.success(t("auth.resetPassword.success"));
      router.push("/login");
    } catch (error) {
      toast.error(t("auth.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.resetPassword.invalidToken")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.invalidTokenDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" asChild>
            <Link href="/forgot-password">{t("auth.resetPassword.requestNew")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{t("auth.resetPassword.title")}</CardTitle>
        <CardDescription>{t("auth.resetPassword.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.resetPassword.newPassword")}</Label>
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
            <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPassword")}</Label>
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
            {isLoading ? t("auth.resetPassword.resetting") : t("auth.resetPassword.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
