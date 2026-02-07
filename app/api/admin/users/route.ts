import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { UserService } from "@/lib/services/user";

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get("q") || "";
      const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");

      let result;
      if (query) {
        result = await UserService.searchUsers(query, limit, offset);
      } else {
        result = await UserService.getAllUsers(limit, offset);
      }

      return NextResponse.json({
        users: result.users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          emailVerified: u.emailVerified,
          createdAt: u.createdAt,
          profile: {
            displayName: u.profile.displayName,
            avatarUrl: u.profile.avatarUrl,
            role: u.profile.role,
          },
        })),
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }
  },
  { requiredRole: "admin" },
);
