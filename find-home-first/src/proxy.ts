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
 */
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

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
