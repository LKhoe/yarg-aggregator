import { createAuthClient } from "better-auth/react";
import { lastfmClientPlugin } from "@ley0x/better-auth-lastfm/client";

export const authClient = createAuthClient({
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
    : {}),
  plugins: [lastfmClientPlugin()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
