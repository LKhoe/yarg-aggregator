import { NextRequest, NextResponse } from "next/server";
import { authRateLimit } from "@/lib/services/rate-limit";

export async function proxy(request: NextRequest) {
  // Rate limit auth sign-in endpoints to prevent brute force
  if (
    request.method === "POST" &&
    request.nextUrl.pathname.startsWith("/api/auth/sign-in")
  ) {
    const rl = await authRateLimit(request);
    if (rl.blocked) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined,
        },
      );
    }
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // CSRF protection for state-changing API requests
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/api/auth/") &&
    ["POST", "PATCH", "PUT", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // Allow requests with no origin (server-to-server, non-browser)
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: "CSRF validation failed" },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: "CSRF validation failed" },
          { status: 403 },
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
