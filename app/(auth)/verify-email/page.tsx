"use client";

import { useTranslations } from "@/hooks/use-translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const { t } = useTranslations();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{t("auth.verifyEmail.title")}</CardTitle>
        <CardDescription>{t("auth.verifyEmail.description")}</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("auth.verifyEmail.checkInbox")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("auth.verifyEmail.spamNote")}
        </p>
        <div className="pt-4">
          <Button variant="outline" asChild>
            <Link href="/login">{t("auth.verifyEmail.backToLogin")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
