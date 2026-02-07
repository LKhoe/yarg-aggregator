import { db } from "@/lib/db";
import { trustedDevice } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { TrustedDevice } from "@/lib/db/schema";

export type DeviceInfo = {
  id: string;
  fingerprint: string;
  browser: string | null;
  os: string | null;
  lastUsedAt: Date;
  createdAt: Date;
};

export class DeviceService {
  static async trustDevice(
    userId: string,
    fingerprint: string,
    browser?: string,
    os?: string,
  ): Promise<TrustedDevice> {
    // Check if device already exists
    const existingResult = await db.select().from(trustedDevice).where(and(eq(trustedDevice.userId, userId), eq(trustedDevice.fingerprint, fingerprint))).limit(1);
    const existing = existingResult[0];

    if (existing) {
      // Update last used timestamp
      const [updated] = await db
        .update(trustedDevice)
        .set({
          lastUsedAt: new Date(),
          browser: browser ?? existing.browser,
          os: os ?? existing.os,
        })
        .where(eq(trustedDevice.id, existing.id))
        .returning();

      return updated;
    }

    // Create new trusted device
    const [device] = await db
      .insert(trustedDevice)
      .values({
        userId,
        fingerprint,
        browser,
        os,
      })
      .returning();

    return device;
  }

  static async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const devicesResult = await db.select().from(trustedDevice).where(eq(trustedDevice.userId, userId));
    const devices = devicesResult;

    return devices.map((d) => ({
      id: d.id,
      fingerprint: d.fingerprint,
      browser: d.browser,
      os: d.os,
      lastUsedAt: d.lastUsedAt,
      createdAt: d.createdAt,
    }));
  }

  static async revokeDevice(
    deviceId: string,
    userId: string,
  ): Promise<boolean> {
    const deviceResult = await db.select().from(trustedDevice).where(and(eq(trustedDevice.id, deviceId), eq(trustedDevice.userId, userId))).limit(1);
    const device = deviceResult[0];

    if (!device) {
      return false;
    }

    await db.delete(trustedDevice).where(eq(trustedDevice.id, deviceId));

    return true;
  }

  static async isDeviceTrusted(
    userId: string,
    fingerprint: string,
  ): Promise<boolean> {
    const deviceResult = await db.select().from(trustedDevice).where(and(eq(trustedDevice.userId, userId), eq(trustedDevice.fingerprint, fingerprint))).limit(1);
    const device = deviceResult[0];

    return !!device;
  }

  static async updateLastUsed(
    userId: string,
    fingerprint: string,
  ): Promise<void> {
    await db
      .update(trustedDevice)
      .set({ lastUsedAt: new Date() })
      .where(
        and(
          eq(trustedDevice.userId, userId),
          eq(trustedDevice.fingerprint, fingerprint),
        ),
      );
  }

  static async revokeAllDevices(userId: string): Promise<void> {
    await db.delete(trustedDevice).where(eq(trustedDevice.userId, userId));
  }
}
