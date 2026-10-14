import type { FetchParseIssue, ProviderMusic, ProviderSource } from "@/types";

export type PageIssue = Omit<FetchParseIssue, "page">;

export interface ProviderPage {
  /** Entries that parsed into songs, in source order (newest first) */
  items: ProviderMusic[];
  /** Entries the source returned that could not be parsed */
  issues: PageIssue[];
  /** Total number of entries the source reports for the query, when it says */
  total: number | null;
  /** Number of entries in the response (items + issues) */
  rawCount: number;
}

export interface ProviderAdapter {
  source: ProviderSource;
  label: string;
  pageSize: number;
  buildRequest(page: number): { url: string; init: RequestInit };
  /** Throws InvalidResponseError when the body is not a normal listing */
  parsePage(json: unknown): ProviderPage;
}

/** Parse each entry on its own so one bad entry never sinks the whole page */
export function parseEntries<T>(
  entries: T[],
  parseOne: (entry: T) => ProviderMusic,
  describe: (entry: T) => { title?: string; artist?: string },
): { items: ProviderMusic[]; issues: PageIssue[] } {
  const items: ProviderMusic[] = [];
  const issues: PageIssue[] = [];
  entries.forEach((entry, index) => {
    try {
      items.push(parseOne(entry));
    } catch (error) {
      let label: { title?: string; artist?: string } = {};
      try {
        label = describe(entry);
      } catch {
        // entry is not even an object
      }
      issues.push({
        index,
        reason: error instanceof Error ? error.message : String(error),
        ...label,
      });
    }
  });
  return { items, issues };
}

export class EntryError extends Error {}

export function requireText(value: unknown, field: string): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string" || value.trim() === "") {
    throw new EntryError(`Missing ${field}`);
  }
  return value;
}

export function optionalText(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  // "2023-01-06 22:14:46" (no zone) is read as UTC, wherever the server runs
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
