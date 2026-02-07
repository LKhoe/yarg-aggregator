"use client";

import { useState } from "react";
import { forgetPassword } from "@/lib/auth-client";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { t } = useTranslations();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await forgetPassword({
        email,
        redirectTo: "/reset-password",
      });
      setIsSubmitted(true);
      toast.success(t("auth.forgotPassword.emailSent"));
    } catch {
      toast.error(t("auth.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.forgotPassword.checkEmail")}</CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.checkEmailDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" asChild>
            <Link href="/login">{t("auth.forgotPassword.backToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
        <CardDescription>
          {t("auth.forgotPassword.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.forgotPassword.email")}</Label>
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? t("auth.forgotPassword.sending")
              : t("auth.forgotPassword.submit")}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
