import { getRedisClient } from "@/lib/redis";
import type { NextRequest } from "next/server";

/**
 * Client IP behind the Cloudflare tunnel. `cf-connecting-ip` is set by Cloudflare itself and
 * cannot be spoofed by the client. Fallback: the LAST `x-forwarded-for` entry, the one appended
 * by the closest proxy (the first entries are whatever the client sent).
 */
export function getClientIp(request: { headers: Pick<Headers, "get"> }): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || "unknown";
}

async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const redis = getRedisClient();
  // INCR + EXPIRE NX in one MULTI: a crash between the two can't leave a key without TTL.
  // (Keys still go through the prefixed client: the ACL only allows yarg:*.)
  const results = await redis
    .multi()
    .incr(key)
    .expire(key, windowSeconds, "NX")
    .exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  if (count > maxAttempts) {
    const ttl = await redis.ttl(key);
    return { blocked: true, retryAfter: ttl > 0 ? ttl : windowSeconds };
  }
  return { blocked: false };
}

/** 10 attempts per 15 minutes per IP, for auth endpoints. */
export async function authRateLimit(
  request: NextRequest,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const ip = getClientIp(request);
  return checkRateLimit(`ratelimit:auth:${ip}`, 10, 900);
}

/** 30 requests per 10 minutes per user, for AI agent endpoint. */
export async function agentRateLimit(
  userId: string,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  return checkRateLimit(`ratelimit:agent:${userId}`, 30, 600);
}

/** 10 uploads per 10 minutes per user, for the shared installed-songs catalog endpoint. */
export async function installedSongsRateLimit(
  userId: string,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  return checkRateLimit(`ratelimit:installed-songs:${userId}`, 10, 600);
}

/** 60 requests per 10 minutes per IP, for the unauthenticated batch music lookup endpoint. */
export async function musicBatchRateLimit(
  request: NextRequest,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const ip = getClientIp(request);
  return checkRateLimit(`ratelimit:music-batch:${ip}`, 60, 600);
}

/** 20 requests per 10 minutes per user, for the external lyrics-lookup proxy (3 upstream calls per request). */
export async function lyricsRateLimit(
  userId: string,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  return checkRateLimit(`ratelimit:lyrics:${userId}`, 20, 600);
}

/** 15 requests per 10 minutes per user, for the external playlist URL import (Spotify/YouTube quota). */
export async function importUrlRateLimit(
  userId: string,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  return checkRateLimit(`ratelimit:import-url:${userId}`, 15, 600);
}

/** 120 requests per minute per IP, for the unauthenticated music search (GET /api/music). */
export async function musicSearchRateLimit(
  request: NextRequest,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const ip = getClientIp(request);
  return checkRateLimit(`ratelimit:music-search:${ip}`, 120, 60);
}
