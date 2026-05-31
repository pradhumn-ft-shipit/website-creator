import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

/**
 * Per-request session refresh + route guard, run from `src/middleware.ts`.
 *
 * Supabase's SSR cookie dance requires a client bound to the *request/response*
 * cookie jars (distinct from the `cookies()`-bound client used in route
 * handlers and Server Components). We refresh the session here so every
 * downstream Server Component sees a fresh user, then enforce the auth
 * boundary: unauthenticated users are bounced to /login (preserving where they
 * were headed via `?next=`), and already-authenticated users are kept out of
 * the auth screens.
 *
 * IMPORTANT (Supabase guidance): always return the `response` object built
 * here, unmodified except for redirects, so the refreshed auth cookies survive.
 */

// Pages reachable without a session. Everything else under the app is gated.
// `/update-password` is public so the recovery-link landing can render; the
// actual password change still needs the recovery session Supabase sets.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/signup/check-email",
  "/reset-password",
  "/update-password",
  "/health",
]);

// Auth screens an already-signed-in user shouldn't sit on.
const AUTH_PATHS = new Set(["/login", "/signup", "/reset-password"]);

function isPublic(pathname: string): boolean {
  // API routes self-gate (apiHandler + the service); never block them here, or
  // /api/auth/* would be unreachable for signed-out users.
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/auth")) return true;
  return PUBLIC_PATHS.has(pathname);
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) revalidates the token with Supabase — the
  // trustworthy check for a guard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_PATHS.has(pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
