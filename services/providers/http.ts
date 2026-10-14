/**
 * HTTP client for provider APIs whose rate limits are unknown.
 *
 * - AdaptivePacer spaces requests out and learns a safe pace: it backs off hard
 *   when the source pushes back (429/403/503) and speeds up slowly after a
 *   streak of successes (AIMD, like TCP congestion control).
 * - requestJson() classifies failures and retries each kind with its own budget:
 *     rate_limit  429, 403, 503+Retry-After → honour Retry-After, slow the pacer
 *     transient   5xx, network, timeout, invalid/unexpected body → exp. backoff
 *     permanent   other 4xx → no retry
 * - Every wait is announced through hooks (for the UI), and waits are sliced so
 *   a cancel request interrupts them.
 */

export type FetchErrorKind = "rate_limit" | "transient" | "permanent";

export class ProviderFetchError extends Error {
  constructor(
    message: string,
    readonly kind: FetchErrorKind,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderFetchError";
  }
}

/** Thrown by a response parser when the body is not what the API normally returns */
export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

export class FetchCancelledError extends Error {
  constructor() {
    super("Fetch cancelled");
    this.name = "FetchCancelledError";
  }
}

export interface PacerOptions {
  initialDelayMs?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** consecutive successes before the delay is reduced */
  speedUpAfter?: number;
}

export class AdaptivePacer {
  private delay: number;
  private readonly min: number;
  private readonly max: number;
  private readonly speedUpAfter: number;
  private lastRequestAt = 0;
  private successStreak = 0;

  constructor(options: PacerOptions = {}) {
    this.min = options.minDelayMs ?? 1000;
    this.max = options.maxDelayMs ?? 60_000;
    this.speedUpAfter = options.speedUpAfter ?? 10;
    this.delay = clamp(options.initialDelayMs ?? 1500, this.min, this.max);
  }

  get delayMs() {
    return this.delay;
  }

  /** How long until the next request may start */
  msUntilNext(now = Date.now()) {
    return Math.max(0, this.lastRequestAt + this.delay - now);
  }

  markRequest(now = Date.now()) {
    this.lastRequestAt = now;
  }

  onSuccess() {
    this.successStreak++;
    if (this.successStreak >= this.speedUpAfter) {
      this.successStreak = 0;
      this.delay = clamp(Math.round(this.delay * 0.85), this.min, this.max);
    }
  }

  onPushback(retryAfterMs?: number) {
    this.successStreak = 0;
    const doubled = this.delay * 2;
    // A Retry-After spread over the next few requests is a decent hint of the real limit
    const hinted = retryAfterMs ? Math.round(retryAfterMs / 4) : 0;
    this.delay = clamp(Math.max(doubled, hinted), this.min, this.max);
  }
}

export interface WaitInfo {
  reason: "rate_limit" | "retry" | "cooldown";
  ms: number;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
}

export interface RequestHooks {
  /** Announces a deliberate wait (backoff / Retry-After), not the normal pacing gap */
  onWait?: (info: WaitInfo) => void | Promise<void>;
  /** Called about once a second while waiting; throw FetchCancelledError to abort */
  onTick?: () => void | Promise<void>;
}

export interface RetryPolicy {
  maxTransientAttempts: number;
  maxRateLimitWaits: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  maxRetryAfterMs: number;
  timeoutMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxTransientAttempts: 5,
  maxRateLimitWaits: 8,
  baseBackoffMs: 2000,
  maxBackoffMs: 60_000,
  maxRetryAfterMs: 10 * 60_000,
  timeoutMs: 30_000,
};

export interface RequestResult<T> {
  data: T;
  attempts: number;
  durationMs: number;
}

/**
 * Sleep in one-second slices so ticks (lock refresh, cancel checks) keep running.
 */
export async function interruptibleSleep(ms: number, hooks?: RequestHooks) {
  const end = Date.now() + ms;
  while (true) {
    await hooks?.onTick?.();
    const left = end - Date.now();
    if (left <= 0) return;
    await new Promise((r) => setTimeout(r, Math.min(1000, left)));
  }
}

export function parseRetryAfter(value: string | null, now = Date.now()) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return undefined;
}

function classifyStatus(status: number): FetchErrorKind {
  if (status === 429 || status === 403) return "rate_limit";
  if (status >= 500 || status === 408 || status === 425) return "transient";
  return "permanent";
}

function backoffMs(attempt: number, policy: RetryPolicy) {
  const exp = policy.baseBackoffMs * 2 ** (attempt - 1);
  const jitter = Math.random() * policy.baseBackoffMs;
  return Math.min(policy.maxBackoffMs, exp + jitter);
}

function describe(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "Request timed out";
    return error.message;
  }
  return String(error);
}

/**
 * Fetch JSON with pacing, classification and retries.
 * `parse` validates the body and must throw InvalidResponseError when it looks
 * wrong (a Cloudflare page, a maintenance message, ...): that is retried as transient.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  parse: (json: unknown) => T,
  pacer: AdaptivePacer,
  hooks: RequestHooks = {},
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<RequestResult<T>> {
  let transientAttempts = 0;
  let rateLimitWaits = 0;
  let attempts = 0;

  while (true) {
    const gap = pacer.msUntilNext();
    if (gap > 0) await interruptibleSleep(gap, hooks);
    await hooks.onTick?.();

    attempts++;
    pacer.markRequest();
    const started = Date.now();

    let failure: ProviderFetchError;
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(policy.timeoutMs),
      });

      if (!response.ok) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        let kind = classifyStatus(response.status);
        // 503 + Retry-After is the polite way of saying "slow down"
        if (response.status === 503 && retryAfterMs !== undefined) kind = "rate_limit";
        // Drain the body so the connection can be reused
        await response.arrayBuffer().catch(() => undefined);
        throw new ProviderFetchError(
          `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
          kind,
          response.status,
          retryAfterMs,
        );
      }

      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new InvalidResponseError(
          `Response is not JSON (${text.slice(0, 60).replace(/\s+/g, " ")}…)`,
        );
      }
      const data = parse(json);
      pacer.onSuccess();
      return { data, attempts, durationMs: Date.now() - started };
    } catch (error) {
      if (error instanceof FetchCancelledError) throw error;
      failure =
        error instanceof ProviderFetchError
          ? error
          : new ProviderFetchError(describe(error), "transient");
    }

    if (failure.kind === "permanent") throw failure;

    if (failure.kind === "rate_limit") {
      rateLimitWaits++;
      pacer.onPushback(failure.retryAfterMs);
      if (rateLimitWaits > policy.maxRateLimitWaits) throw failure;
      const fallback = Math.min(
        5 * 60_000,
        Math.max(pacer.delayMs * 2, 15_000 * 2 ** (rateLimitWaits - 1)),
      );
      const ms = Math.min(policy.maxRetryAfterMs, failure.retryAfterMs ?? fallback);
      await hooks.onWait?.({
        reason: "rate_limit",
        ms,
        attempt: rateLimitWaits,
        maxAttempts: policy.maxRateLimitWaits,
        error: failure.message,
      });
      await interruptibleSleep(ms, hooks);
      continue;
    }

    transientAttempts++;
    if (transientAttempts >= policy.maxTransientAttempts) throw failure;
    const ms = backoffMs(transientAttempts, policy);
    await hooks.onWait?.({
      reason: "retry",
      ms,
      attempt: transientAttempts,
      maxAttempts: policy.maxTransientAttempts,
      error: failure.message,
    });
    await interruptibleSleep(ms, hooks);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
