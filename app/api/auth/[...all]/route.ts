import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { authRateLimit } from "@/lib/services/rate-limit";

const { GET, POST: handlePOST } = toNextJsHandler(auth);

export { GET };

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined,
      },
    );
  }

  return handlePOST(request);
}
