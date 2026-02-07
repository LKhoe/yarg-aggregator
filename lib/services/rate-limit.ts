import { db } from "@/lib/db";
import { rateLimitAttempt } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

const RATE_LIMIT_CONFIG = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 5 * 60 * 1000, // 5 minutes lockout
};

export type IdentifierType = "ip" | "account";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  lockedUntil: Date | null;
};

export class RateLimitService {
  static async checkRateLimit(
    identifier: string,
    identifierType: IdentifierType,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.windowMs);

    // Find existing rate limit record
    const existingResult = await db.select().from(rateLimitAttempt).where(and(eq(rateLimitAttempt.identifier, identifier), eq(rateLimitAttempt.identifierType, identifierType), gt(rateLimitAttempt.windowStart, windowStart))).limit(1);
    const existing = existingResult[0];

    // Check if currently locked out
    if (existing?.lockedUntil && existing.lockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        lockedUntil: existing.lockedUntil,
      };
    }

    // Calculate remaining attempts
    const attemptCount = existing?.attemptCount ?? 0;
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - attemptCount);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: existing
        ? new Date(existing.windowStart.getTime() + RATE_LIMIT_CONFIG.windowMs)
        : null,
      lockedUntil: null,
    };
  }

  static async recordAttempt(
    identifier: string,
    identifierType: IdentifierType,
    success: boolean,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.windowMs);

    // Find existing record within window
    const existingResult = await db.select().from(rateLimitAttempt).where(and(eq(rateLimitAttempt.identifier, identifier), eq(rateLimitAttempt.identifierType, identifierType), gt(rateLimitAttempt.windowStart, windowStart))).limit(1);
    const existing = existingResult[0];

    if (success) {
      // On success, reset the counter
      if (existing) {
        await db
          .delete(rateLimitAttempt)
          .where(eq(rateLimitAttempt.id, existing.id));
      }
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxAttempts,
        resetAt: null,
        lockedUntil: null,
      };
    }

    // On failure, increment counter
    const newAttemptCount = (existing?.attemptCount ?? 0) + 1;
    const shouldLock = newAttemptCount >= RATE_LIMIT_CONFIG.maxAttempts;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + RATE_LIMIT_CONFIG.lockoutMs)
      : null;

    if (existing) {
      await db
        .update(rateLimitAttempt)
        .set({
          attemptCount: newAttemptCount,
          lockedUntil,
        })
        .where(eq(rateLimitAttempt.id, existing.id));
    } else {
      await db.insert(rateLimitAttempt).values({
        identifier,
        identifierType,
        attemptCount: newAttemptCount,
        lockedUntil,
        windowStart: now,
      });
    }

    return {
      allowed: !shouldLock,
      remaining: Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - newAttemptCount),
      resetAt: new Date(now.getTime() + RATE_LIMIT_CONFIG.windowMs),
      lockedUntil,
    };
  }

  static async resetAttempts(
    identifier: string,
    identifierType: IdentifierType,
  ): Promise<void> {
    await db
      .delete(rateLimitAttempt)
      .where(
        and(
          eq(rateLimitAttempt.identifier, identifier),
          eq(rateLimitAttempt.identifierType, identifierType),
        ),
      );
  }

  static async cleanupExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs * 2);

    const result = await db
      .delete(rateLimitAttempt)
      .where(
        and(
          gt(rateLimitAttempt.windowStart, cutoff)
        ),
      );

    return 0; // Drizzle doesn't return count easily
  }
}
