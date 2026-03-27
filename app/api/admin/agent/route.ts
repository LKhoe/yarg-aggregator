import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { MusicService } from "@/lib/services/music";
import { ListService } from "@/lib/services/list";
import { db } from "@/lib/db";
import {
  genre,
  song,
  artist,
  album,
  userProfile,
  agentConversation,
  agentMessage,
} from "@/lib/db/schema";
import { count, eq, asc } from "drizzle-orm";


const SYSTEM_PROMPT = `You are an AI assistant for the YARG Content Aggregator, an admin tool for managing music charts for YARG (Yet Another Rhythm Game) — an open-source rhythm game similar to Rock Band and Guitar Hero.

## About the Platform
- Charts (songs) are indexed from external sources: Enchor.us and Rhythmverse
- Each chart supports up to 5 instruments: guitar, bass, drums, keys, vocals
- Difficulty is rated 0–6 per instrument (0 = easiest, 6 = hardest)
- Users can create song lists/playlists and mark favorites
- Songs can be linked to local game installations

## Your Capabilities
You can help admins with:
1. Natural language song search with filters (genre, instrument, difficulty, source)
2. Platform statistics and insights
3. Setlist/playlist curation and recommendations
4. Browsing available genres and user lists

## Guidelines
- Always use tools to fetch real data before answering questions about songs or stats
- When recommending setlists, search for songs matching the criteria and present the results
- Keep responses concise and useful for an admin context
- Difficulty 0–2 = beginner, 3–4 = intermediate, 5–6 = expert

## Language
- IMPORTANT: Always respond in the same language the user is writing in.
- The user's preferred locale is provided below. Use this as a hint for your response language.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_songs",
      description:
        "Search for songs in the database. Returns up to 10 matching songs with title, artist, genre, instruments, and difficulty.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (song title, artist, charter, etc.)",
          },
          genre: {
            type: "string",
            description: "Filter by genre name (exact match)",
          },
          instruments: {
            type: "array",
            items: {
              type: "string",
              enum: ["guitar", "bass", "drums", "keys", "vocals"],
            },
            description: "Filter to songs that have these instruments charted",
          },
          source: {
            type: "string",
            enum: ["", "enchor", "rhythmverse"],
            description: "Filter by data source",
          },
          sortBy: {
            type: "string",
            enum: ["relevance", "name", "artist", "album", "createdAt"],
            description: "Sort field (default: relevance)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_song_details",
      description:
        "Get detailed information about a specific song by its ID, including all difficulty levels and download URLs.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Song UUID",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_genres",
      description: "Get all available genre names in the database.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stats",
      description:
        "Get platform statistics: total number of songs, artists, and albums.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_lists",
      description:
        "Get public song lists/playlists for a user by display name.",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "User's display name",
          },
        },
        required: ["username"],
      },
    },
  },
];

type ToolCallTrace = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  toolCallId?: string;
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_songs": {
      const result = await MusicService.search({
        query: (args.query as string) ?? "",
        limit: 10,
        sortBy: ((args.sortBy as string) ?? "relevance") as
          | "relevance"
          | "name"
          | "artist"
          | "album"
          | "createdAt",
        sortOrder: "desc",
        genre: (args.genre as string) ?? "",
        instruments: (args.instruments as string[]) ?? [],
        source: ((args.source as string) ?? "") as
          | ""
          | "enchor"
          | "rhythmverse",
        cursor: null,
      });
      return {
        total: result.total,
        returned: result.data.length,
        songs: result.data.map((s) => ({
          id: s.id,
          name: s.name,
          artist: s.artist,
          album: s.album,
          genre: s.genre,
          year: s.year,
          charter: s.charter,
          instruments: s.instruments,
        })),
      };
    }

    case "get_song_details": {
      return await MusicService.findById(args.id as string);
    }

    case "get_genres": {
      const genres = await db.select({ name: genre.name }).from(genre);
      return { genres: genres.map((g) => g.name).sort() };
    }

    case "get_stats": {
      const [songCount, artistCount, albumCount] = await Promise.all([
        db.select({ count: count() }).from(song),
        db.select({ count: count() }).from(artist),
        db.select({ count: count() }).from(album),
      ]);
      return {
        songs: songCount[0].count,
        artists: artistCount[0].count,
        albums: albumCount[0].count,
      };
    }

    case "get_user_lists": {
      const profileResult = await db
        .select({ userId: userProfile.userId })
        .from(userProfile)
        .where(eq(userProfile.displayName, args.username as string))
        .limit(1);
      if (!profileResult[0]) return { error: "User not found" };
      const lists = await ListService.getPublicLists(profileResult[0].userId);
      return { lists };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  "pt-BR": "Brazilian Portuguese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  zh: "Chinese",
};

const FALLBACK_MODEL = "google/gemma-3-27b-it:free";

const MALFORMED_TOOL_CALL_PATTERN =
  /<\/?tool_call>|<\/?function_call>|\{"name"\s*:\s*"(search_songs|get_song_details|get_genres|get_stats|get_user_lists)"/;

function hasTextToolCalls(content: string | null | undefined): boolean {
  if (typeof content !== "string") return false;
  return MALFORMED_TOOL_CALL_PATTERN.test(content);
}

type ChatResponse = {
  model?: string;
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: string;
  }[];
};

async function sendChat(
  model: string,
  messages: Message[],
): Promise<ChatResponse> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => {
          if (m.role === "tool") {
            return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
          }
          if (m.role === "assistant" && m.toolCalls) {
            return { role: "assistant", content: m.content, tool_calls: m.toolCalls };
          }
          return { role: m.role, content: m.content };
        }),
        tools: TOOLS,
        tool_choice: "auto",
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  return response.json();
}

async function runAgentLoop(
  clientMessages: { role: "user" | "assistant"; content: string }[],
  locale: string = "en",
  model?: string,
): Promise<{ reply: string; toolCalls: ToolCallTrace[]; model: string }> {
  const languageName = LOCALE_NAMES[locale] ?? LOCALE_NAMES.en;
  const systemPrompt = `${SYSTEM_PROMPT}\n- User's preferred language: ${languageName} (${locale}). Respond in ${languageName}.`;

  const baseMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...clientMessages,
  ];

  const activeModel = model ?? FALLBACK_MODEL;

  let result;
  try {
    result = await runWithModel(activeModel, [...baseMessages]);
  } catch (e) {
    if (activeModel !== FALLBACK_MODEL && e instanceof Error && e.message.includes("404")) {
      result = await runWithModel(FALLBACK_MODEL, [...baseMessages]);
    } else {
      throw e;
    }
  }

  if (result.malformed && activeModel !== FALLBACK_MODEL) {
    return runWithModel(FALLBACK_MODEL, [...baseMessages]);
  }

  return result;
}

async function runWithModel(
  model: string,
  messages: Message[],
): Promise<{
  reply: string;
  toolCalls: ToolCallTrace[];
  model: string;
  malformed?: boolean;
}> {
  const toolCalls: ToolCallTrace[] = [];
  let usedModel = model;

  for (let i = 0; i < 5; i++) {
    const response = await sendChat(model, messages);

    const choice = response.choices?.[0];
    if (!choice) throw new Error("No choices in OpenRouter response");

    if (response.model) {
      usedModel = response.model;
    }

    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: typeof msg.content === "string" ? msg.content : "",
        toolCalls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        const result = await executeTool(tc.function.name, args);
        toolCalls.push({ name: tc.function.name, args, result });

        messages.push({
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      const content =
        typeof msg.content === "string" ? msg.content : null;

      if (hasTextToolCalls(content)) {
        return {
          reply: "",
          toolCalls,
          model: usedModel,
          malformed: true,
        };
      }

      return {
        reply:
          content ??
          "I was unable to generate a response. Please try again.",
        toolCalls,
        model: usedModel,
      };
    }
  }

  // Max tool iterations reached — force a final answer without tools
  messages.push({
    role: "user",
    content:
      "You have already called tools multiple times. Now answer the user's question using only the data you have collected so far. Do NOT call any more tools.",
  });

  const finalResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => {
          if (m.role === "tool") {
            return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
          }
          if (m.role === "assistant" && m.toolCalls) {
            return { role: "assistant", content: m.content, tool_calls: m.toolCalls };
          }
          return { role: m.role, content: m.content };
        }),
      }),
    },
  );

  if (!finalResponse.ok) {
    return {
      reply: "I was unable to generate a response. Please try again.",
      toolCalls,
      model: usedModel,
    };
  }

  const finalData: ChatResponse = await finalResponse.json();
  const finalChoice = finalData.choices?.[0];
  const finalContent =
    typeof finalChoice?.message?.content === "string"
      ? finalChoice.message.content
      : null;

  if (finalData.model) {
    usedModel = finalData.model;
  }

  return {
    reply:
      finalContent ??
      "I was unable to generate a response. Please try again.",
    toolCalls,
    model: usedModel,
  };
}

async function generateTitle(
  conversationId: string,
  firstMessage: string,
  locale: string,
): Promise<void> {
  const language = LOCALE_NAMES[locale] ?? LOCALE_NAMES.en;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages: [
          {
            role: "user",
            content: `Generate a short title (max 50 characters) in ${language} for a conversation that starts with this message. Reply with ONLY the title, no quotes, no punctuation at the end.\n\n${firstMessage}`,
          },
        ],
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const title = data.choices?.[0]?.message?.content?.trim()?.slice(0, 50);
    if (!title) return;

    await db
      .update(agentConversation)
      .set({ title, updatedAt: new Date() })
      .where(eq(agentConversation.id, conversationId));
  } catch {
    // fire-and-forget — don't fail the request
  }
}

async function translateError(
  error: string,
  locale: string,
): Promise<string> {
  const language = LOCALE_NAMES[locale];
  if (!language || locale === "en") return error;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages: [
          {
            role: "user",
            content: `Translate the following error message to ${language}. Reply with ONLY the translated text, nothing else.\n\n${error}`,
          },
        ],
      }),
    });

    if (!res.ok) return error;

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || error;
  } catch {
    return error;
  }
}

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const body = await request.json();
    const { message, conversationId: existingConvId, locale, model } = body as {
      message: string;
      conversationId?: string;
      locale?: string;
      model?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 503 },
      );
    }

    // Resolve or create conversation
    let conversationId = existingConvId;
    let isFirstMessage = false;

    if (conversationId) {
      // Verify ownership
      const conv = await db
        .select({ id: agentConversation.id })
        .from(agentConversation)
        .where(eq(agentConversation.id, conversationId))
        .limit(1);

      if (!conv[0]) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
    } else {
      // Create new conversation
      const [conv] = await db
        .insert(agentConversation)
        .values({ userId: user.id, model: model ?? FALLBACK_MODEL })
        .returning({ id: agentConversation.id });
      conversationId = conv.id;
      isFirstMessage = true;
    }

    // Save the user message
    await db.insert(agentMessage).values({
      conversationId,
      role: "user",
      content: message.trim(),
    });

    // Build message history from DB
    const dbMessages = await db
      .select({ role: agentMessage.role, content: agentMessage.content })
      .from(agentMessage)
      .where(eq(agentMessage.conversationId, conversationId))
      .orderBy(asc(agentMessage.createdAt));

    const chatMessages = dbMessages.map((m) => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

    try {
      const result = await runAgentLoop(chatMessages, locale, model);

      // Save the assistant message
      await db.insert(agentMessage).values({
        conversationId,
        role: "assistant",
        content: result.reply,
        model: result.model,
        toolCalls: result.toolCalls.length > 0
          ? JSON.stringify(result.toolCalls)
          : null,
      });

      // Update conversation metadata
      await db
        .update(agentConversation)
        .set({ model: result.model, updatedAt: new Date() })
        .where(eq(agentConversation.id, conversationId));

      // Generate title for the first message (fire-and-forget)
      if (isFirstMessage) {
        generateTitle(conversationId, message.trim(), locale ?? "en").catch(
          () => {},
        );
      }

      return NextResponse.json({
        reply: result.reply,
        toolCalls: result.toolCalls,
        model: result.model,
        conversationId,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      const translated = await translateError(errMsg, locale ?? "en");
      return NextResponse.json({ error: translated }, { status: 502 });
    }
  },
  { requiredRole: "admin" },
);
