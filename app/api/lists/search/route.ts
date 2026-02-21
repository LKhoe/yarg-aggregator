import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const lists = await ListService.searchPublicLists(query, authUser.id);
    return NextResponse.json(lists);
  } catch (error) {
    console.error("Error searching public lists:", error);
    return NextResponse.json({ error: "Failed to search lists" }, { status: 500 });
  }
}
