// Import types
import type { IProvider } from "@/types";

export const convertProvider = (provider: any): IProvider => ({
  ...provider,
  _id: provider.id,
  lastSuccessfulFetch: provider.lastSuccessfulFetch || undefined,
});
