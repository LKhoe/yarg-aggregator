import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { ListService } from "@/lib/services/list";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lists = await ListService.getUserLists(authUser.id);

    return NextResponse.json(
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        slug: list.slug,
        isFavorites: list.isFavorites,
        isPublic: list.isPublic,
        itemCount: list.itemCount,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
    );
  } catch (error) {
    console.error("Error fetching lists:", error);
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, isPublic = true } = body;

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
      return NextResponse.json(
        { error: "Name must be between 1 and 50 characters" },
        { status: 400 },
      );
    }

    const list = await ListService.createList(authUser.id, name, isPublic);

    return NextResponse.json({
      id: list.id,
      name: list.name,
      slug: list.slug,
      isFavorites: list.isFavorites,
      isPublic: list.isPublic,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    });
  } catch (error) {
    console.error("Error creating list:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
