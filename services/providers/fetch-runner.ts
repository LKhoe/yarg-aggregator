/**
 * Runs one provider fetch so that no content is silently lost:
 *
 * - Pages are fetched newest-first and saved one by one, so a failure costs one
 *   page, not the whole run.
 * - A page that still fails after its retries becomes a *gap*, bounded by the
 *   timestamps of its neighbours. At the end of the pass every gap is re-fetched
 *   by walking from its page until its lower timestamp is crossed, which stays
 *   correct even when the listing shifted in the meantime.
 * - Gaps that still fail stay on the run: the user can retry them, and the
 *   provider cursor (where the next incremental fetch stops) never moves past
 *   one, so the next fetch also covers them.
 * - The not-yet-fetched rest of a pass is persisted as a pending gap, so a
 *   crash, restart or cancel leaves a run that can simply be resumed.
 */
import { db } from "@/lib/db";
import { downloadUrl, providerFetchRun, type ProviderFetchRun } from "@/lib/db/schema";
import { countDistinct, eq } from "drizzle-orm";
import { PROVIDER_EVENTS_CHANNEL, getRedisClient } from "@/lib/redis";
import { ProviderService } from "@/lib/services/provider";
import { processSongs } from "@/services/songs";
import type {
  FetchGap,
  FetchLogCode,
  FetchLogEntry,
  FetchPageState,
  FetchParseIssue,
  FetchRunPhase,
  FetchRunSnapshot,
  FetchRunStatus,
  FetchSongDetail,
  FetchWaitState,
  ProviderMusic,
  ProviderSource,
} from "@/types";
import {
  AdaptivePacer,
  DEFAULT_RETRY_POLICY,
  FetchCancelledError,
  interruptibleSleep,
  requestJson,
  type PacerOptions,
  type RetryPolicy,
  type WaitInfo,
} from "./http";
import { enchorAdapter } from "./enchor";
import { rhythmverseAdapter } from "./rhythmverse";
import type { ProviderAdapter, ProviderPage } from "./types";

export const PROVIDER_ADAPTERS: Record<ProviderSource, ProviderAdapter> = {
  enchor: enchorAdapter,
  rhythmverse: rhythmverseAdapter,
};

export const providerKeys = {
  lock: (source: ProviderSource) => `provider:${source}:running`,
  cancel: (source: ProviderSource) => `provider:${source}:cancel`,
  snapshot: (source: ProviderSource) => `provider:${source}:progress`,
  pace: (source: ProviderSource) => `provider:${source}:pace`,
};

export const LOCK_TTL_SECONDS = 120;
/** The next incremental fetch re-reads this much below the cursor (clock skew, late indexing) */
const CURSOR_OVERLAP_MS = 24 * 60 * 60 * 1000;
/** Consecutive failed pages before pausing; a second trip ends the pass */
const CIRCUIT_FAILURES = 3;
const CIRCUIT_COOLDOWN_MS = 2 * 60_000;
const GAP_RETRY_COOLDOWN_MS = 30_000;
const MAX_STEP_BACKS = 3;
const LOG_LIMIT = 50;
const ISSUES_LIMIT = 200;
const DETAILS_LIMIT = 1000;
const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface FetchJobData {
  runId: string;
  source: ProviderSource;
  action: "fetch" | "retry_gaps";
}

interface Segment {
  startPage: number;
  upperTs: Date | null;
  lowerTs: Date | null;
  isGapRetry: boolean;
  /** How fetched pages show on the page map ("r" = recovered after a failure) */
  markAs: FetchPageState;
}

type PageOutcome =
  | { ok: true; page: ProviderPage; attempts: number; durationMs: number }
  | { ok: false; error: string; attempts: number };

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);
const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

function datedRange(items: ProviderMusic[]) {
  let newest: Date | null = null;
  let oldest: Date | null = null;
  for (const item of items) {
    const ts = item.sourceUpdatedAt;
    if (!ts) continue;
    if (!newest || ts > newest) newest = ts;
    if (!oldest || ts < oldest) oldest = ts;
  }
  return { newest, oldest };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface RunnerOptions {
  adapter?: ProviderAdapter;
  policy?: RetryPolicy;
  /** Tests: shorter cooldowns and pacing */
  cooldowns?: { circuitMs: number; gapRetryMs: number };
  pacer?: PacerOptions;
}

export class ProviderFetchRunner {
  private readonly redis = getRedisClient();
  private readonly adapter: ProviderAdapter;
  private readonly policy: RetryPolicy;
  private readonly cooldowns: { circuitMs: number; gapRetryMs: number };
  private readonly pacerOptions: PacerOptions;
  private pacer!: AdaptivePacer;

  private row!: ProviderFetchRun;
  private status: FetchRunStatus = "running";
  private phase: FetchRunPhase = "fetching";
  private gaps: FetchGap[] = [];
  private rest: FetchGap | null = null;
  private pageMap: FetchPageState[] = [];
  private issues: FetchParseIssue[] = [];
  private log: FetchLogEntry[] = [];
  private wait: FetchWaitState | null = null;
  private details = {
    added: [] as FetchSongDetail[],
    updated: [] as FetchSongDetail[],
    ignored: {} as Record<string, FetchSongDetail[]>,
    truncated: false,
  };
  private songCount: number | undefined;
  private lastLockRefresh = 0;
  private lastCancelCheck = 0;

  constructor(
    private readonly job: FetchJobData,
    options: RunnerOptions = {},
  ) {
    this.adapter = options.adapter ?? PROVIDER_ADAPTERS[job.source];
    this.policy = options.policy ?? DEFAULT_RETRY_POLICY;
    this.pacerOptions = options.pacer ?? {};
    this.cooldowns = options.cooldowns ?? {
      circuitMs: CIRCUIT_COOLDOWN_MS,
      gapRetryMs: GAP_RETRY_COOLDOWN_MS,
    };
  }

  private get source() {
    return this.job.source;
  }

  async execute(): Promise<FetchRunStatus> {
    const [row] = await db
      .select()
      .from(providerFetchRun)
      .where(eq(providerFetchRun.id, this.job.runId))
      .limit(1);
    if (!row) throw new Error(`Fetch run ${this.job.runId} not found`);
    this.row = row;
    this.loadRow(row);

    await this.redis.set(providerKeys.lock(this.source), row.id, "EX", LOCK_TTL_SECONDS);
    this.lastLockRefresh = Date.now();
    const savedPace = Number(await this.redis.get(providerKeys.pace(this.source)));
    this.pacer = new AdaptivePacer({
      initialDelayMs: Number.isFinite(savedPace) && savedPace > 0 ? savedPace : undefined,
      ...this.pacerOptions,
    });

    let fatal: string | null = null;
    let cancelled = false;
    try {
      // A run that was still "running" is being re-delivered after a crash
      const resume =
        this.job.action === "retry_gaps" || row.status !== "queued";
      if (resume) {
        await this.retryGaps();
      } else {
        await this.mainPass();
        await this.retryGaps();
      }
    } catch (error) {
      if (error instanceof FetchCancelledError) {
        cancelled = true;
        this.addLog("warn", "cancelled");
      } else {
        fatal = errorMessage(error);
        console.error(`[fetch ${this.source}] run failed:`, error);
      }
    }

    await this.finish({ cancelled, fatal });
    return this.status;
  }

  // ------------------------------------------------------------------ passes

  private async mainPass() {
    const cursor = await ProviderService.getSourceCursor(this.source);
    const cutoff =
      this.row.mode === "incremental" && cursor
        ? new Date(cursor.getTime() - CURSOR_OVERLAP_MS)
        : null;

    this.row.cutoff = cutoff;
    this.row.startedAt = new Date();
    this.status = "running";
    this.phase = "fetching";
    this.addLog("info", "run_started", {
      mode: this.row.mode,
      cutoff: cutoff ? cutoff.toISOString() : "",
    });
    await db
      .update(providerFetchRun)
      .set({ status: "running", cutoff, startedAt: this.row.startedAt, updatedAt: new Date() })
      .where(eq(providerFetchRun.id, this.row.id));
    await this.publish();

    await this.fetchSegment({
      startPage: 1,
      upperTs: null,
      lowerTs: cutoff,
      isGapRetry: false,
      markAs: "d",
    });
  }

  private async retryGaps() {
    const pending = this.gaps.map((gap) => ({ ...gap, pending: false }));
    this.gaps = [];
    if (pending.length === 0) return;

    if (this.status !== "running") {
      this.status = "running";
      this.row.startedAt ??= new Date();
      this.row.finishedAt = null;
      await db
        .update(providerFetchRun)
        .set({ status: "running", finishedAt: null, updatedAt: new Date() })
        .where(eq(providerFetchRun.id, this.row.id));
    }
    this.phase = "retrying_gaps";
    this.gaps = pending;
    await this.publish();

    if (this.job.action === "fetch" && this.row.status === "queued") {
      // Fresh run: give the source a breather before going back to what failed
      await this.announceWait({ reason: "cooldown", ms: this.cooldowns.gapRetryMs }, null);
      await interruptibleSleep(this.cooldowns.gapRetryMs, { onTick: () => this.tick() });
      this.wait = null;
    }

    const cutoff = this.row.cutoff;
    for (const gap of pending) {
      // attempts === 0: the unfetched rest of a stopped/interrupted pass, not a failure
      const isRest = gap.attempts === 0;
      this.gaps = this.gaps.filter((g) => g !== gap);
      const before = this.gaps.length;
      this.addLog("info", isRest ? "resumed" : "gap_retry", { page: gap.page });
      await this.fetchSegment({
        startPage: Math.max(1, gap.page),
        upperTs: toDate(gap.upperTs),
        lowerTs: toDate(gap.lowerTs) ?? cutoff,
        isGapRetry: true,
        markAs: isRest ? "d" : "r",
      });
      const recovered = this.gaps.length === before;
      if (!recovered) {
        this.addLog("warn", "gap_still_failing", { page: gap.page });
      } else if (!isRest) {
        if (this.pageMap[gap.page - 1] === "f") this.pageMap[gap.page - 1] = "r";
        this.addLog("info", "gap_recovered", { page: gap.page });
      }
      await this.persist();
      await this.publish();
    }
  }

  /**
   * Walk pages from seg.startPage until an item at/below seg.lowerTs is reached
   * (or the listing ends). Failed pages become gaps; the walk continues.
   */
  private async fetchSegment(seg: Segment) {
    const pageSize = this.adapter.pageSize;
    let page = seg.startPage;
    let lastTs = seg.upperTs; // oldest dated item before `page`
    let lastTotal: number | null = null;
    let openGaps: FetchGap[] = []; // failed pages still waiting for their lower bound
    let consecutiveFailures = 0;
    let circuitTrips = 0;
    let stepBacks = 0;
    let firstPage = true;
    let lastError = "";

    const updateRest = (nextPage: number) => {
      this.rest = {
        page: nextPage,
        upperTs: iso(lastTs),
        lowerTs: iso(seg.lowerTs),
        attempts: 0,
        error: "Not fetched yet",
        pending: true,
      };
    };
    updateRest(page);

    /** Records `page` as a gap; returns true when the pass must stop (circuit tripped twice) */
    const onFailure = async (error: string, attempts: number) => {
      consecutiveFailures++;
      lastError = error;
      const gap: FetchGap = { page, upperTs: iso(lastTs), lowerTs: null, attempts, error };
      openGaps.push(gap);
      this.gaps.push(gap);
      this.markPage(page, "f");
      if (consecutiveFailures < CIRCUIT_FAILURES) return false;

      circuitTrips++;
      if (circuitTrips > 1) {
        this.closeSegmentAfterCircuit(openGaps, seg, lastError);
        await this.persist();
        await this.publish();
        return true;
      }
      this.addLog("warn", "circuit_open", {
        failures: consecutiveFailures,
        seconds: Math.round(this.cooldowns.circuitMs / 1000),
      });
      await this.announceWait({ reason: "cooldown", ms: this.cooldowns.circuitMs }, page + 1);
      await interruptibleSleep(this.cooldowns.circuitMs, { onTick: () => this.tick() });
      this.wait = null;
      consecutiveFailures = CIRCUIT_FAILURES - 1;
      return false;
    };

    while (true) {
      await this.tick(true);
      this.row.currentPage = page;
      const outcome = await this.fetchPage(page);

      if (!outcome.ok) {
        this.addLog("error", "page_failed", {
          page,
          attempts: outcome.attempts,
          error: outcome.error,
        });
        if (await onFailure(outcome.error, outcome.attempts)) return;
        const knownLast = lastTotal !== null ? Math.ceil(lastTotal / pageSize) : null;
        if (knownLast !== null && page >= knownLast) break;
        page++;
        updateRest(page);
        await this.persist();
        await this.publish();
        continue;
      }

      const { items, issues, total, rawCount } = outcome.page;
      const { newest, oldest } = datedRange(items);

      // Gap retry: start at or above the gap. Step back until a page reaches the
      // item just before the gap (normally one page of overlap; more if entries
      // above were deleted and the gap slid onto earlier pages)
      if (
        seg.isGapRetry &&
        firstPage &&
        page > 1 &&
        seg.upperTs &&
        newest &&
        newest < seg.upperTs &&
        stepBacks < MAX_STEP_BACKS
      ) {
        stepBacks++;
        page--;
        continue;
      }
      firstPage = false;

      if (newest) {
        for (const gap of openGaps) gap.lowerTs = newest.toISOString();
        openGaps = [];
      }

      let saved: Awaited<ReturnType<typeof processSongs>>;
      try {
        saved = await processSongs(items, this.source);
      } catch (error) {
        console.error(`[fetch ${this.source}] saving page ${page} failed:`, error);
        this.addLog("error", "processing_failed", { page, error: errorMessage(error) });
        if (await onFailure(`Saving failed: ${errorMessage(error)}`, 1)) return;
        page++;
        updateRest(page);
        await this.persist();
        await this.publish();
        continue;
      }

      consecutiveFailures = 0;
      this.row.songsFetched += items.length;
      this.row.added += saved.added;
      this.row.updated += saved.updated;
      this.row.ignored += saved.ignored;
      this.collectDetails(saved.details);
      if (issues.length > 0) {
        this.row.parseIssues += issues.length;
        for (const issue of issues) {
          if (this.issues.length < ISSUES_LIMIT) this.issues.push({ page, ...issue });
        }
        this.addLog("warn", "page_issues", { page, count: issues.length });
      }
      if (newest && (!this.row.newestSeenAt || newest > this.row.newestSeenAt)) {
        this.row.newestSeenAt = newest;
      }
      if (oldest && (!this.row.oldestSeenAt || oldest < this.row.oldestSeenAt)) {
        this.row.oldestSeenAt = oldest;
      }
      if (oldest) lastTs = oldest;
      if (total !== null) this.row.totalPages = Math.max(1, Math.ceil(total / pageSize));

      this.markPage(page, seg.markAs);
      this.addLog("info", "page_ok", {
        page,
        songs: items.length,
        ms: outcome.durationMs,
        attempts: outcome.attempts,
      });

      // The listing shrank (entries deleted above us): everything moved up, so
      // step back to avoid skipping the entries that slid onto earlier pages
      if (
        total !== null &&
        lastTotal !== null &&
        total < lastTotal &&
        stepBacks < MAX_STEP_BACKS
      ) {
        const back = Math.ceil((lastTotal - total) / pageSize);
        stepBacks++;
        this.addLog("warn", "source_shrank", { page, removed: lastTotal - total });
        lastTotal = total;
        page = Math.max(seg.startPage, page - back);
        updateRest(page);
        await this.persist();
        await this.publish();
        continue;
      }
      if (total !== null) lastTotal = total;

      const reachedLower = !!(seg.lowerTs && oldest && oldest <= seg.lowerTs);
      const lastPage =
        rawCount === 0 ||
        (total !== null && page >= Math.ceil(total / pageSize)) ||
        (total === null && rawCount < pageSize);

      if (reachedLower || lastPage) break;
      page++;
      updateRest(page);
      await this.persist();
      await this.publish();
    }

    // Failed pages at the very end: they reach down to the segment's bound
    for (const gap of openGaps) gap.lowerTs = iso(seg.lowerTs);
    this.rest = null;
    await this.persist();
    await this.publish();
  }

  /** Repeated failures: stop this pass and keep the whole unfetched stretch as one gap */
  private closeSegmentAfterCircuit(openGaps: FetchGap[], seg: Segment, lastError: string) {
    const first = openGaps[0];
    this.gaps = this.gaps.filter((g) => !openGaps.includes(g));
    this.gaps.push({
      page: first.page,
      upperTs: first.upperTs,
      lowerTs: iso(seg.lowerTs),
      attempts: openGaps.reduce((sum, g) => sum + g.attempts, 0),
      error: `Stopped after repeated failures: ${lastError}`,
    });
    this.rest = null;
  }

  private async fetchPage(page: number): Promise<PageOutcome> {
    const { url, init } = this.adapter.buildRequest(page);
    let waits = 0;
    try {
      const result = await requestJson(
        url,
        init,
        (json) => this.adapter.parsePage(json),
        this.pacer,
        {
          onWait: async (info) => {
            waits++;
            await this.announceWait(info, page);
          },
          onTick: () => this.tick(),
        },
        this.policy,
      );
      if (this.wait) {
        this.wait = null;
        await this.publish();
      }
      return { ok: true, page: result.data, attempts: result.attempts, durationMs: result.durationMs };
    } catch (error) {
      if (error instanceof FetchCancelledError) throw error;
      this.wait = null;
      return { ok: false, error: errorMessage(error), attempts: waits + 1 };
    }
  }

  // ------------------------------------------------------------------ finish

  private async finish({ cancelled, fatal }: { cancelled: boolean; fatal: string | null }) {
    this.wait = null;
    if (this.rest) {
      // Whatever was not fetched yet becomes a real gap, so it can be resumed
      this.gaps.push({
        ...this.rest,
        pending: false,
        error: cancelled ? "Cancelled" : fatal ? `Run failed: ${fatal}` : "Not fetched",
      });
      this.rest = null;
    }

    if (cancelled) this.status = "cancelled";
    else if (fatal) this.status = "failed";
    else if (this.gaps.length > 0)
      this.status = this.row.songsFetched > 0 ? "completed_with_errors" : "failed";
    else this.status = "completed";
    this.phase = "done";
    this.row.error = fatal ?? (this.gaps.length > 0 ? this.gaps[this.gaps.length - 1].error : null);

    try {
      await this.updateCursor();
      if (this.status === "completed" || this.status === "completed_with_errors") {
        await ProviderService.updateLastSuccessfulFetch(this.source);
      }
    } catch (error) {
      console.error(`[fetch ${this.source}] cursor update failed:`, error);
    }

    this.addLog(this.status === "completed" ? "info" : "warn", "run_finished", {
      status: this.status,
      added: this.row.added,
      updated: this.row.updated,
      gaps: this.gaps.length,
    });

    try {
      const [row] = await db
        .select({ count: countDistinct(downloadUrl.songId) })
        .from(downloadUrl)
        .where(eq(downloadUrl.source, this.source));
      this.songCount = row?.count;
    } catch {
      // only cosmetic
    }

    try {
      await this.persist(new Date());
    } catch (error) {
      console.error(`[fetch ${this.source}] could not save the final run state:`, error);
    }
    await this.publish(true);
    await this.redis.set(providerKeys.pace(this.source), String(this.pacer.delayMs), "EX", 30 * 24 * 3600);
    await this.redis.del(providerKeys.cancel(this.source));
    if ((await this.redis.get(providerKeys.lock(this.source))) === this.row.id) {
      await this.redis.del(providerKeys.lock(this.source));
    }
    console.log(
      `[fetch ${this.source}] ${this.status}: ${this.row.songsFetched} songs, +${this.row.added} ~${this.row.updated} =${this.row.ignored}, ${this.row.parseIssues} unparseable, ${this.gaps.length} gap(s)`,
    );
  }

  /**
   * Everything newer than the cursor gets re-read by the next incremental fetch.
   * With gaps left, the cursor may only move up to the lowest gap's lower bound.
   */
  private async updateCursor() {
    if (this.gaps.length === 0) {
      if (this.row.newestSeenAt) {
        await ProviderService.advanceSourceCursor(this.source, this.row.newestSeenAt);
      }
      return;
    }
    if (this.gaps.some((g) => !g.lowerTs)) return;
    const lowest = this.gaps
      .map((g) => new Date(g.lowerTs!))
      .reduce((min, d) => (d < min ? d : min));
    await ProviderService.advanceSourceCursor(this.source, lowest);
  }

  // ------------------------------------------------------------------ state

  private loadRow(row: ProviderFetchRun) {
    this.gaps = (row.gaps ?? []).map((gap) => ({ ...gap, pending: false }));
    this.issues = row.issues ?? [];
    this.pageMap = row.pageMap.split("") as FetchPageState[];
    this.status = row.status;
    this.phase = row.status === "queued" ? "queued" : "fetching";
  }

  private markPage(page: number, state: FetchPageState) {
    while (this.pageMap.length < page) this.pageMap.push(".");
    const current = this.pageMap[page - 1];
    // A page that came back in a gap retry stays visible as "recovered"
    if (state === "d" && current === "r") return;
    this.pageMap[page - 1] = state;
  }

  private collectDetails(details: Awaited<ReturnType<typeof processSongs>>["details"]) {
    const push = (list: FetchSongDetail[], items: FetchSongDetail[]) => {
      for (const item of items) {
        if (list.length >= DETAILS_LIMIT) {
          this.details.truncated = true;
          return;
        }
        list.push({ artist: item.artist, title: item.title });
      }
    };
    push(this.details.added, details.added);
    push(this.details.updated, details.updated);
    for (const item of details.ignored) {
      const list = (this.details.ignored[item.reason] ??= []);
      push(list, [item]);
    }
  }

  private addLog(
    level: FetchLogEntry["level"],
    code: FetchLogCode,
    params?: FetchLogEntry["params"],
  ) {
    this.log.push({ at: new Date().toISOString(), level, code, params });
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
  }

  private async announceWait(info: WaitInfo, page: number | null) {
    this.wait = {
      reason: info.reason,
      until: new Date(Date.now() + info.ms).toISOString(),
      page,
      attempt: info.attempt,
      maxAttempts: info.maxAttempts,
      error: info.error,
    };
    if (info.reason !== "cooldown") {
      this.addLog("warn", info.reason === "rate_limit" ? "rate_limited" : "page_retry", {
        page: page ?? 0,
        seconds: Math.round(info.ms / 1000),
        attempt: info.attempt ?? 0,
        max: info.maxAttempts ?? 0,
        error: info.error ?? "",
      });
    }
    await this.publish();
  }

  /**
   * Lock refresh + cancel check. Runs before every page (forced) and about once
   * a second during waits (throttled).
   */
  private async tick(force = false) {
    const now = Date.now();
    if (now - this.lastLockRefresh > 30_000) {
      this.lastLockRefresh = now;
      await this.redis.set(providerKeys.lock(this.source), this.row.id, "EX", LOCK_TTL_SECONDS);
    }
    if (force || now - this.lastCancelCheck > 1500) {
      this.lastCancelCheck = now;
      if (await this.redis.get(providerKeys.cancel(this.source))) {
        throw new FetchCancelledError();
      }
    }
  }

  private persistedGaps(): FetchGap[] {
    return this.rest ? [...this.gaps, this.rest] : this.gaps;
  }

  private async persist(finishedAt?: Date) {
    await db
      .update(providerFetchRun)
      .set({
        status: this.status,
        currentPage: this.row.currentPage,
        totalPages: this.row.totalPages,
        pageMap: this.pageMap.join(""),
        songsFetched: this.row.songsFetched,
        added: this.row.added,
        updated: this.row.updated,
        ignored: this.row.ignored,
        parseIssues: this.row.parseIssues,
        newestSeenAt: this.row.newestSeenAt,
        oldestSeenAt: this.row.oldestSeenAt,
        gaps: this.persistedGaps(),
        issues: this.issues,
        error: this.row.error,
        ...(finishedAt ? { finishedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(providerFetchRun.id, this.row.id));
    if (finishedAt) this.row.finishedAt = finishedAt;
  }

  private snapshot(final: boolean): FetchRunSnapshot {
    return {
      runId: this.row.id,
      source: this.source,
      mode: this.row.mode,
      status: this.status,
      phase: this.phase,
      startedAt: iso(this.row.startedAt),
      finishedAt: iso(this.row.finishedAt),
      cutoff: iso(this.row.cutoff),
      currentPage: this.row.currentPage || null,
      totalPages: this.row.totalPages,
      pageMap: this.pageMap.join(""),
      songsFetched: this.row.songsFetched,
      stats: { added: this.row.added, updated: this.row.updated, ignored: this.row.ignored },
      parseIssues: this.row.parseIssues,
      gaps: this.gaps,
      wait: this.wait,
      paceMs: this.pacer?.delayMs ?? 0,
      log: this.log,
      error: this.row.error,
      ...(final
        ? { details: { ...this.details, issues: this.issues }, songCount: this.songCount }
        : {}),
    };
  }

  private async publish(final = false) {
    const snapshot = this.snapshot(final);
    const json = JSON.stringify(snapshot);
    try {
      if (final) {
        await this.redis.set(providerKeys.snapshot(this.source), json, "EX", SNAPSHOT_TTL_SECONDS);
      } else {
        await this.redis.set(providerKeys.snapshot(this.source), json);
      }
      await this.redis.publish(
        PROVIDER_EVENTS_CHANNEL,
        JSON.stringify({ type: "snapshot", source: this.source, run: snapshot }),
      );
    } catch (error) {
      console.error(`[fetch ${this.source}] could not publish progress:`, error);
    }
  }
}

/** Snapshot for a run that has no live state in Redis (old run, or just queued) */
export function snapshotFromRow(row: ProviderFetchRun): FetchRunSnapshot {
  const done = !["queued", "running"].includes(row.status);
  return {
    runId: row.id,
    source: row.source,
    mode: row.mode,
    status: row.status,
    phase: row.status === "queued" ? "queued" : done ? "done" : "fetching",
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    cutoff: iso(row.cutoff),
    currentPage: row.currentPage || null,
    totalPages: row.totalPages,
    pageMap: row.pageMap,
    songsFetched: row.songsFetched,
    stats: { added: row.added, updated: row.updated, ignored: row.ignored },
    parseIssues: row.parseIssues,
    gaps: (row.gaps ?? []).filter((g) => !g.pending),
    wait: null,
    paceMs: 0,
    log: [],
    error: row.error,
    ...(done
      ? {
          details: {
            added: [],
            updated: [],
            ignored: {},
            issues: row.issues ?? [],
            truncated: false,
          },
        }
      : {}),
  };
}

export async function publishSnapshot(snapshot: FetchRunSnapshot) {
  const redis = getRedisClient();
  await redis.set(providerKeys.snapshot(snapshot.source), JSON.stringify(snapshot), "EX", SNAPSHOT_TTL_SECONDS);
  await redis.publish(
    PROVIDER_EVENTS_CHANNEL,
    JSON.stringify({ type: "snapshot", source: snapshot.source, run: snapshot }),
  );
}

/**
 * At boot nothing can be running yet: a "running" run belongs to a process that
 * died. Its pending gap (the unfetched rest) becomes a real gap, so the run can
 * be resumed (BullMQ re-delivers the stalled job, or the user retries).
 */
export async function recoverInterruptedRuns() {
  const stale = await db
    .select()
    .from(providerFetchRun)
    .where(eq(providerFetchRun.status, "running"));
  for (const row of stale) {
    const gaps = (row.gaps ?? []).map((gap) =>
      gap.pending ? { ...gap, pending: false, error: "Interrupted (server restarted)" } : gap,
    );
    const [updated] = await db
      .update(providerFetchRun)
      .set({ status: "interrupted", gaps, error: "Interrupted (server restarted)", updatedAt: new Date() })
      .where(eq(providerFetchRun.id, row.id))
      .returning();
    if (updated) await publishSnapshot(snapshotFromRow(updated)).catch(() => undefined);
    console.warn(`[fetch ${row.source}] run ${row.id} was interrupted; it can be resumed`);
  }
}
