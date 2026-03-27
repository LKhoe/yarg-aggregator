"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

type Conversation = {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConversationListProps = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  refreshKey: number;
};

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  return `${diffDay}d`;
}

export function ConversationList({
  activeId,
  onSelect,
  onNewChat,
  refreshKey,
}: ConversationListProps) {
  const { t } = useTranslations();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agent/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshKey]);

  async function handleDelete(id: string) {
    await fetch(`/api/admin/agent/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      onNewChat();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          {t("agent.conversations.newChat")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-2 px-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("agent.conversations.noConversations")}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-1 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? "bg-muted"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelect(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conv.title || t("agent.conversations.untitled")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(conv.updatedAt, t)}
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("agent.conversations.deleteTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("agent.conversations.deleteDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("agent.conversations.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(conv.id)}
                      >
                        {t("agent.conversations.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
