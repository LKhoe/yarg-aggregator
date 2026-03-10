"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Shield,
  HardDrive,
  Activity,
  ArrowLeft,
  FileArchive,
  FileText,
  CloudDownload,
  Bot,
  Music2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function AdminDashboardContent() {
  const { t } = useTranslations();

  const adminLinks = [
    {
      title: t("admin.userManagement"),
      description: t("admin.userManagementDescription"),
      href: "/admin/users",
      icon: Users,
    },
    {
      title: t("admin.installations.title"),
      description: t("admin.installations.description"),
      href: "/admin/installations",
      icon: HardDrive,
    },
    {
      title: "Monitoring",
      description: "Queue health, DB stats, Web Vitals, and API errors",
      href: "/admin/monitoring",
      icon: Activity,
    },
    {
      title: "Batch Extractor",
      description: "Extract song data from STFS / CON packages in your browser",
      href: "/admin/batch-extractor",
      icon: FileArchive,
    },
    {
      title: t("cacheDeserializer.title"),
      description: t("cacheDeserializer.description"),
      href: "/admin/cache-deserializer",
      icon: FileText,
    },
    {
      title: t("provider.title"),
      description: t("provider.description"),
      href: "/admin/providers",
      icon: CloudDownload,
    },
    {
      title: "AI Agent",
      description:
        "Natural language search, recommendations, and setlist curation",
      href: "/admin/agent",
      icon: Bot,
    },
    {
      title: "Chart Editor",
      description: "Upload, edit, and export .mid/.chart files",
      href: "/admin/chart-editor",
      icon: Music2,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("admin.dashboard")}</h1>
          <p className="text-muted-foreground">
            {t("admin.dashboardDescription")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full justify-center">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 min-w-10 rounded-lg bg-primary/10">
                    <link.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
