import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { DeviceService } from "@/lib/services/device";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: deviceId } = await params;

    const success = await DeviceService.revokeDevice(deviceId, authUser.id);

    if (!success) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking device:", error);
    return NextResponse.json({ error: "Failed to revoke device" }, { status: 500 });
  }
}
