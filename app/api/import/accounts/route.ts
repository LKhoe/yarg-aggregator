import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";
import { getLinkedAccount, hasRequiredScopes } from "@/lib/services/platform-auth";

const PROVIDERS = ["spotify", "google"] as const;

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accounts = await Promise.all(
      PROVIDERS.map(async (providerId) => {
        const acc = await getLinkedAccount(authUser.id, providerId);
        return {
          provider: providerId,
          linked: !!acc,
          hasScopes: acc ? hasRequiredScopes(acc.scope, providerId) : false,
        };
      }),
    );

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching import accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}
