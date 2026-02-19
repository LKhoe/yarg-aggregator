import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { generateAppleMusicDeveloperToken } from "@/lib/services/platform-auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = generateAppleMusicDeveloperToken();
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json(
      { error: "Apple Music is not configured on this server" },
      { status: 503 },
    );
  }
}
