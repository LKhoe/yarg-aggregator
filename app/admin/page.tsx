"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Shield } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { InstallationProvider } from "@/components/installations/InstallationSelector";

const ProviderPanel = dynamic(
  () => import("@/components/providers/ProviderPanel"),
  {
    loading: () => <div className="animate-pulse bg-muted h-32 rounded-lg" />,
    ssr: false,
  },
);

const CacheDeserializer = dynamic(
  () => import("@/components/cache/CacheDeserializer"),
  {
    loading: () => <div className="animate-pulse bg-muted h-32 rounded-lg" />,
    ssr: false,
  },
);

function AdminDashboardContent() {
  const { t } = useTranslations();

  const adminLinks = [
    {
      title: t("admin.userManagement"),
      description: t("admin.userManagementDescription"),
      href: "/admin/users",
      icon: Users,
    },
  ];

  return (
    <InstallationProvider>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
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
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
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

        <div className="grid gap-4 md:grid-cols-2">
          <CacheDeserializer />
          <ProviderPanel />
        </div>
      </div>
    </InstallationProvider>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
