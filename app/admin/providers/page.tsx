"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CloudDownload } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ProviderPanel = dynamic(
  () => import("@/components/providers/ProviderPanel"),
  {
    loading: () => <div className="animate-pulse bg-muted h-32 rounded-lg" />,
    ssr: false,
  },
);

function ProvidersContent() {
  const { t } = useTranslations();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <CloudDownload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none">
              {t("provider.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("provider.description")}
            </p>
          </div>
        </div>
      </div>

      <ProviderPanel />
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <ProvidersContent />
    </ProtectedRoute>
  );
}
