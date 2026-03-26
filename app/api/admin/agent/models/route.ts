import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { OpenRouter } from "@openrouter/sdk";

export type AgentModel = {
  id: string;
  name: string;
};

export const GET = withAuth(
  async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const client = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const response = await client.models.list({
      supportedParameters: "tools",
    });
    const allModels = response.data ?? [];

    const freeWithTools: AgentModel[] = allModels
      .filter((m) => {
        const isFree =
          Number(m.pricing.prompt) === 0 &&
          Number(m.pricing.completion) === 0;
        return isFree;
      })
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models: freeWithTools });
  },
  { requiredRole: "admin" },
);
