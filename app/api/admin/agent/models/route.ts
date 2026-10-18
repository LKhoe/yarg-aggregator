import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { isLLMConfigured, listLLMTiers, type LLMTier } from "@/lib/services/llm";

export type AgentModel = {
  id: string;
  name: string;
};

// The picker offers the gateway's tiers; the first one is preselected
const ORDER: LLMTier[] = ["medium", "simple", "hard"];
const LABELS: Record<LLMTier, string> = {
  simple: "Simple (free)",
  medium: "Medium (cheap)",
  hard: "Hard (best, pricier)",
};

export const GET = withAuth(
  async () => {
    if (!isLLMConfigured()) {
      return NextResponse.json(
        { error: "LLM_BASE_URL / LLM_API_KEY are not configured" },
        { status: 503 },
      );
    }

    const tiers = await listLLMTiers();
    const models: AgentModel[] = ORDER.flatMap((id) => {
      const tier = tiers.find((t) => t.id === id);
      return tier ? [{ id, name: `${LABELS[id]} · ${tier.models[0] ?? tier.fallback ?? ""}` }] : [];
    });

    return NextResponse.json({ models });
  },
  { requiredRole: "admin" },
);
