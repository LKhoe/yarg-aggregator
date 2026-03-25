"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Bot, User, ChevronDown, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "@/hooks/use-translations";

type ToolCallTrace = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

type ChatMessage = {
  role: "user" | "agent";
  content: string;
  toolCalls?: ToolCallTrace[];
};

const STARTER_PROMPTS = [
  "agent.chat.starterPrompts.howManySongs",
  "agent.chat.starterPrompts.whatGenres",
  "agent.chat.starterPrompts.jazzGuitar",
  "agent.chat.starterPrompts.beginnerDrummers",
];

function MessageBubble({
  message,
  t,
}: {
  message: ChatMessage;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const isUser = message.role === "user";

  function ToolCallCard({ trace }: { trace: ToolCallTrace }) {
    return (
      <details className="group text-xs border border-border rounded-md overflow-hidden">
        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-muted/50 hover:bg-muted select-none list-none">
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180 shrink-0" />
          <span className="font-mono font-medium text-primary">
            {TOOL_NAME_KEYS[trace.name]
              ? t(TOOL_NAME_KEYS[trace.name])
              : trace.name}
          </span>
          <span className="text-muted-foreground truncate">
            {Object.keys(trace.args).length > 0
              ? Object.entries(trace.args)
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join(", ")
              : t("agent.chat.toolCalls.noArgs")}
          </span>
        </summary>
        <div className="divide-y divide-border">
          {Object.keys(trace.args).length > 0 && (
            <div className="px-3 py-2">
              <p className="text-muted-foreground mb-1 font-medium">
                {t("agent.chat.toolCalls.args")}
              </p>
              <pre className="text-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(trace.args, null, 2)}
              </pre>
            </div>
          )}
          <div className="px-3 py-2">
            <p className="text-muted-foreground mb-1 font-medium">
              {t("agent.chat.toolCalls.result")}
            </p>
            <pre className="text-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(trace.result, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      <div
        className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-1">
            {message.toolCalls.map((trace, i) => (
              <ToolCallCard key={i} trace={trace} />
            ))}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
              : "bg-muted text-foreground rounded-tl-sm prose prose-sm prose-neutral dark:prose-invert max-w-none"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

const TOOL_NAME_KEYS: Record<string, string> = {
  search_songs: "agent.chat.toolNames.searchSongs",
  get_song_details: "agent.chat.toolNames.getSongDetails",
  get_genres: "agent.chat.toolNames.getGenres",
  get_stats: "agent.chat.toolNames.getStats",
  get_user_lists: "agent.chat.toolNames.getUserLists",
};

export function AgentChat() {
  const { t, locale } = useTranslations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function handleSend(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: userText };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: m.content,
      }));

      const res = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, locale }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const { reply, toolCalls } = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: reply, toolCalls },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: t("agent.chat.error", {
            error: err instanceof Error ? err.message : "Unknown error",
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-5 py-4 pr-1"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">{t("agent.chat.title")}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {t("agent.chat.description")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(t(prompt))}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  {t(prompt)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} t={t} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("agent.chat.thinking")}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("agent.chat.input.placeholder")}
            className="resize-none min-h-10 max-h-40"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t("agent.chat.poweredBy")}
        </p>
      </div>
    </div>
  );
}
