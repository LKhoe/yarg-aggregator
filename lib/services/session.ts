import { db } from "@/lib/db";
import { session } from "@/lib/db/schema";
import { eq, and, gt, lt, ne } from "drizzle-orm";

export type SessionInfo = {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent?: boolean;
};

export class SessionService {
  static async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const now = new Date();

    const sessionsResult = await db.select().from(session).where(and(eq(session.userId, userId), gt(session.expiresAt, now)));
    const sessions = sessionsResult;

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  static async invalidateSession(sessionId: string): Promise<boolean> {
    const result = await db
      .delete(session)
      .where(eq(session.id, sessionId));

    return true;
  }

  static async invalidateAllUserSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    if (exceptSessionId) {
      await db
        .delete(session)
        .where(
          and(
            eq(session.userId, userId),
            ne(session.id, exceptSessionId)
          ),
        );
    } else {
      await db.delete(session).where(eq(session.userId, userId));
    }

    return 0; // Drizzle doesn't easily return affected rows
  }

  static async invalidateOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    const sessionsResult = await db.select().from(session).where(eq(session.userId, userId));
    const sessions = sessionsResult;

    for (const s of sessions) {
      if (s.id !== currentSessionId) {
        await db.delete(session).where(eq(session.id, s.id));
      }
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();

    await db.delete(session).where(lt(session.expiresAt, now));

    return 0;
  }
}
