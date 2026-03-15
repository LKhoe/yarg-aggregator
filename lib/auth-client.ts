import { createAuthClient } from "better-auth/react";
import { lastfmClientPlugin } from "@ley0x/better-auth-lastfm/client";

export const authClient = createAuthClient({
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
    : {}),
  plugins: [lastfmClientPlugin()],
});

export const forgetPassword = async ({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) => {
  // Mock implementation - simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In a real implementation, this would:
  // 1. Validate the email exists
  // 2. Generate a reset token
  // 3. Send reset email
  // 4. Return success or throw error
  //
  // From the docs
  // import { betterAuth } from 'better-auth';
  // import { sendEmail } from './email'; // your email sending function

  // export const auth = betterAuth({
  //     emailAndPassword: {
  //         enabled: true,
  //         sendResetPassword: async ({ user, url, token }, request) => {
  //             void sendEmail({
  //                 to: user.email,
  //                 subject: 'Reset your password',
  //                 text: `Click the link to reset your password: ${url}`
  //             })
  //         }
  //     }
  // })

  console.log(
    `Password reset requested for ${email}, redirect to: ${redirectTo}`,
  );

  // Always succeed for mock purposes
  return { success: true };
};

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  resetPassword,
} = authClient;
