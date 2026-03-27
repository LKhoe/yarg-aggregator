import { NextRequest, NextResponse } from "next/server";
import { pushVital, type WebVitalMetric } from "@/lib/monitoring";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    // Silently discard unauthenticated vitals so sendBeacon fire-and-forget still works
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await request.json();
    const metric: WebVitalMetric = {
      name: String(body.name),
      value: Number(body.value),
      rating: body.rating as WebVitalMetric["rating"],
      path: String(body.path),
      timestamp: String(body.timestamp),
    };
    await pushVital(metric);
  } catch {
    // Silently ignore malformed payloads
  }
  return new NextResponse(null, { status: 204 });
}
