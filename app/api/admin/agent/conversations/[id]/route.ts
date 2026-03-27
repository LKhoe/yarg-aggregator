import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { agentConversation, agentMessage } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || !hasPermission(user.profile.role, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await db
    .select()
    .from(agentConversation)
    .where(
      and(
        eq(agentConversation.id, id),
        eq(agentConversation.userId, user.id),
      ),
    )
    .limit(1);

  if (!conversation[0]) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const messages = await db
    .select()
    .from(agentMessage)
    .where(eq(agentMessage.conversationId, id))
    .orderBy(asc(agentMessage.createdAt));

  return NextResponse.json({
    conversation: conversation[0],
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
      createdAt: m.createdAt,
    })),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser(request);
  if (!user || !hasPermission(user.profile.role, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await db
    .select({ id: agentConversation.id })
    .from(agentConversation)
    .where(
      and(
        eq(agentConversation.id, id),
        eq(agentConversation.userId, user.id),
      ),
    )
    .limit(1);

  if (!conversation[0]) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  await db.delete(agentConversation).where(eq(agentConversation.id, id));

  return NextResponse.json({ success: true });
}
