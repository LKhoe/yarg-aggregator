import { NextRequest, NextResponse } from "next/server";
import { pushVital, type WebVitalMetric } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
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
