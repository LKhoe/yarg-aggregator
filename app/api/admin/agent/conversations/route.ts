import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { agentConversation } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = withAuth(
  async (_request, { user }) => {
    const conversations = await db
      .select({
        id: agentConversation.id,
        title: agentConversation.title,
        model: agentConversation.model,
        createdAt: agentConversation.createdAt,
        updatedAt: agentConversation.updatedAt,
      })
      .from(agentConversation)
      .where(eq(agentConversation.userId, user.id))
      .orderBy(desc(agentConversation.updatedAt));

    return NextResponse.json({ conversations });
  },
  { requiredRole: "admin" },
);
