import { db } from "@/lib/db";
import { provider } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { convertProvider } from "@/lib/db/converters";
import type { IProvider } from "@/types";

export class ProviderService {
  static async findByName(
    name: "enchor" | "rhythmverse",
  ): Promise<IProvider | null> {
    const [providerRecord] = await db
      .select()
      .from(provider)
      .where(eq(provider.name, name))
      .limit(1);
    return providerRecord ? convertProvider(providerRecord) : null;
  }

  static async create(name: "enchor" | "rhythmverse"): Promise<IProvider> {
    const [newProvider] = await db
      .insert(provider)
      .values({
        id: crypto.randomUUID(),
        name,
      })
      .returning();

    return convertProvider(newProvider);
  }

  static async findOrCreate(
    name: "enchor" | "rhythmverse",
  ): Promise<IProvider> {
    const existing = await this.findByName(name);
    if (existing) return existing;
    return this.create(name);
  }

  static async updateLastSuccessfulFetch(
    name: "enchor" | "rhythmverse",
  ): Promise<void> {
    await this.findOrCreate(name);
    await db
      .update(provider)
      .set({ lastSuccessfulFetch: new Date() })
      .where(eq(provider.name, name));
  }

  static async updateLastSuccessfulFetchIfNewer(
    name: "enchor" | "rhythmverse",
    date: Date,
  ): Promise<void> {
    const existing = await this.findOrCreate(name);
    if (
      !existing.lastSuccessfulFetch ||
      date > existing.lastSuccessfulFetch
    ) {
      await db
        .update(provider)
        .set({ lastSuccessfulFetch: date })
        .where(eq(provider.name, name));
    }
  }

  static async getAll(): Promise<IProvider[]> {
    const providers = await db.select().from(provider);
    return providers.map(convertProvider);
  }
}
