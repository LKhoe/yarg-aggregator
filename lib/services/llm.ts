// LLM calls go through LocalInfra's LLM gateway (../LocalInfra, container localinfra-llm).
// It holds the OpenRouter key, picks the model for a tier and enforces this app's limits on
// paid calls. Provision the key with:
//   ../LocalInfra/scripts/provision-app.sh yarg . --no-postgres --no-redis --llm
//
//   simple → free models, then a small local model (no tools there): the admin agent by
//            default, titles, translations
//   medium → cheap paid models, more reliable tool calls (the admin can pick it)
//   hard   → good, pricier paid models

export const LLM_TIERS = ["simple", "medium", "hard"] as const;
export type LLMTier = (typeof LLM_TIERS)[number];

export function isLLMTier(value: unknown): value is LLMTier {
  return typeof value === "string" && (LLM_TIERS as readonly string[]).includes(value);
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  // The gateway's monthly budget or daily paid-call limit for this app
  get isLimit(): boolean {
    return this.status === 429;
  }
}

function endpoint(path: string): string {
  return `${(process.env.LLM_BASE_URL ?? "").replace(/\/$/, "")}${path}`;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function llmChat<T>(body: { model: LLMTier } & Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint("/chat/completions"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message ?? text;
    } catch {
      // not JSON
    }
    throw new LLMError(`LLM gateway error ${res.status}: ${message.slice(0, 300)}`, res.status);
  }
  return res.json();
}

export type LLMTierInfo = { id: LLMTier; paid: boolean; models: string[]; fallback?: string };

export async function listLLMTiers(): Promise<LLMTierInfo[]> {
  const res = await fetch(endpoint("/models"), { headers: headers() });
  if (!res.ok) throw new LLMError(`LLM gateway error ${res.status}`, res.status);
  const { data } = (await res.json()) as { data: LLMTierInfo[] };
  return data.filter((t) => isLLMTier(t.id));
}
