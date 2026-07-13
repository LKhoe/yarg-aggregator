import { NextRequest, NextResponse } from "next/server";
import { pushVital, type WebVitalMetric } from "@/lib/monitoring";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const MAX_NAME_LENGTH = 50;
const MAX_PATH_LENGTH = 500;
const MAX_TIMESTAMP_LENGTH = 50;

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    // Silently discard unauthenticated vitals so sendBeacon fire-and-forget still works
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await request.json();

    if (!VALID_RATINGS.has(body.rating)) {
      return new NextResponse(null, { status: 204 });
    }

    const metric: WebVitalMetric = {
      name: String(body.name).slice(0, MAX_NAME_LENGTH),
      value: Number(body.value),
      rating: body.rating as WebVitalMetric["rating"],
      path: String(body.path).slice(0, MAX_PATH_LENGTH),
      timestamp: String(body.timestamp).slice(0, MAX_TIMESTAMP_LENGTH),
    };
    await pushVital(metric);
  } catch {
    // Silently ignore malformed payloads
  }
  return new NextResponse(null, { status: 204 });
}
