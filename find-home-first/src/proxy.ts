/**
 * Clerk proxy — Next.js 16 convention (replaces middleware.ts).
 *
 * Attaches Clerk session data to every request matching the config.
 * Authorization is enforced close to protected resources:
 *   - requireUser()         — any authenticated user
 *   - requireOrganization() — authenticated + organization membership
 *   - requireRole()         — membership with a specific role
 *   - organization-filtered repository functions
 *
 * Public routes (/sign-in, /sign-up) are handled by Clerk automatically:
 * unauthenticated requests to protected pages receive a 401/redirect
 * from auth.protect() inside requireOrganization().
 *
 * Main-workspace navigation to Find Properties resumes the user's most recently
 * saved property-search draft from the database. Explicit ranked-ZIP and project
 * navigation remain untouched.
 */
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const MAIN_WORKSPACE_PATHS = new Set(["/", "/people", "/tasks", "/plan"]);

function getRefererPath(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).pathname;
  } catch {
    return null;
  }
}

export default clerkMiddleware(async (_auth, request) => {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/housing-search") {
    const rankedZip = request.nextUrl.searchParams.get("zip");
    const refererPath = getRefererPath(request);

    // Main navigation means "resume my property-search work". Do not trust a
    // stale project query carried by browser/client navigation; resolve the
    // newest saved draft server-side instead. Ranked-ZIP handoffs remain explicit
    // and therefore bypass this redirect.
    if (!rankedZip && refererPath && MAIN_WORKSPACE_PATHS.has(refererPath)) {
      const target = request.nextUrl.clone();
      target.pathname = "/housing-search/resume";
      target.search = "";
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk frontend API routes
    "/__clerk/(.*)",
  ],
};
