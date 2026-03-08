"use client";

import { useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AgentChat } from "@/components/admin/AgentChat";
import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/use-translations";

function AgentContent() {
  const { t } = useTranslations();
  
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none">{t("agent.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("agent.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <AgentChat />
    </div>
  );
}

export default function AdminAgentPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AgentContent />
    </ProtectedRoute>
  );
}
