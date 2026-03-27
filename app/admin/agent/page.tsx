"use client";

import { useEffect, useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AgentChat } from "@/components/admin/AgentChat";
import { ConversationList } from "@/components/admin/ConversationList";
import { ArrowLeft, Bot, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useTranslations } from "@/hooks/use-translations";

function AgentContent() {
  const { t } = useTranslations();
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setDrawerOpen(false);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveConversationId(id);
    setDrawerOpen(false);
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setActiveConversationId(id);
    // Refresh sidebar after a delay to pick up the generated title
    setTimeout(() => setRefreshKey((k) => k + 1), 3000);
  }, []);

  const sidebar = (
    <ConversationList
      activeId={activeConversationId}
      onSelect={handleSelect}
      onNewChat={handleNewChat}
      refreshKey={refreshKey}
    />
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-6xl mx-auto gap-0">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-72 shrink-0 border-r border-border">
        {sidebar}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 px-4 md:px-6">
        <div className="flex items-center gap-3 py-2">
          {/* Mobile drawer toggle */}
          <Drawer
            direction="left"
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
          >
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent
              className="h-full w-80 rounded-none fixed top-0 bottom-0 left-0"
              aria-describedby={undefined}
            >
              <div className="pt-4 h-full">{sidebar}</div>
            </DrawerContent>
          </Drawer>

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
              <h1 className="text-2xl font-bold leading-none">
                {t("agent.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("agent.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <AgentChat
          key={activeConversationId ?? "new"}
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
        />
      </div>
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
