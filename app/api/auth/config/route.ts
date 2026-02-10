import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    // Access the emailAndPassword configuration from auth
    const emailAndPasswordConfig = auth.options.emailAndPassword;
    
    return NextResponse.json({
      requireEmailVerification: emailAndPasswordConfig?.requireEmailVerification ?? false,
    });
  } catch (error) {
    console.error("Error fetching auth config:", error);
    return NextResponse.json(
      { error: "Failed to fetch auth configuration" },
      { status: 500 }
    );
  }
}
