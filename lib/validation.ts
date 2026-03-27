export const ALLOWED_LOCALES = ["en", "pt-BR", "es", "fr", "de", "ja", "zh"] as const;
export type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

export function isValidLocale(v: unknown): v is AllowedLocale {
  return ALLOWED_LOCALES.includes(v as AllowedLocale);
}

export function isValidHttpsUrl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export const MAX_ARRAY_INPUT = 500;
export const MAX_LIST_IDS = 50;
