// Import types
import type { IProvider } from "@/types";

interface RawProvider {
  id: string;
  name: "enchor" | "rhythmverse";
  lastSuccessfulFetch?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const convertProvider = (provider: RawProvider): IProvider => ({
  ...provider,
  _id: provider.id,
  lastSuccessfulFetch: provider.lastSuccessfulFetch || undefined,
});
