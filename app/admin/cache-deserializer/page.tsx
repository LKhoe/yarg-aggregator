"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const CacheDeserializer = dynamic(
  () => import("@/components/cache/CacheDeserializer"),
  {
    loading: () => <div className="animate-pulse bg-muted h-32 rounded-lg" />,
    ssr: false,
  },
);

function CacheDeserializerContent() {
  const { t } = useTranslations();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="w-full">
            <div className="flex justify-between gap-2">
              <h1 className="text-2xl font-bold leading-none">
                {t("cacheDeserializer.title")}
              </h1>
              <a
                href="https://github.com/YARC-Official/YARG.Core"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                YARC-Official/YARG.Core
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("cacheDeserializer.description")}
            </p>
          </div>
        </div>
      </div>

      <CacheDeserializer />
    </div>
  );
}

export default function CacheDeserializerPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <CacheDeserializerContent />
    </ProtectedRoute>
  );
}
