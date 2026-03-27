import { getRedisClient } from "@/lib/redis";
import { NextRequest } from "next/server";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const redis = getRedisClient();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
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
