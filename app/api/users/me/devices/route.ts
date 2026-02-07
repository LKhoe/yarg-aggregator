import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { DeviceService } from "@/lib/services/device";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const devices = await DeviceService.getUserDevices(authUser.id);
    return NextResponse.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fingerprint, browser, os } = body;

    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json(
        { error: "Fingerprint is required" },
        { status: 400 },
      );
    }

    const device = await DeviceService.trustDevice(
      authUser.id,
      fingerprint,
      browser,
      os,
    );

    return NextResponse.json({
      id: device.id,
      fingerprint: device.fingerprint,
      browser: device.browser,
      os: device.os,
      lastUsedAt: device.lastUsedAt,
      createdAt: device.createdAt,
    });
  } catch (error) {
    console.error("Error trusting device:", error);
    return NextResponse.json({ error: "Failed to trust device" }, { status: 500 });
  }
}
