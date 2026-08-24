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
 * The active Find Properties project is also remembered here as a session
 * cookie. This keeps project context authoritative at the request boundary
 * instead of relying only on client-side React/sessionStorage timing.
 */
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ACTIVE_PROJECT_COOKIE = "fhf_active_project";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProjectId(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

function setActiveProjectCookie(response: NextResponse, projectId: string) {
  response.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

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
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Any concrete project workspace establishes the active project context.
  const projectPathMatch = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  const projectFromPath = projectPathMatch?.[1] ?? null;
  if (isProjectId(projectFromPath)) {
    setActiveProjectCookie(response, projectFromPath);
  }

  if (pathname === "/housing-search") {
    const queryProject = request.nextUrl.searchParams.get("project");
    const rankedZip = request.nextUrl.searchParams.get("zip");
    const rememberedProject = request.cookies.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
    const refererPath = getRefererPath(request);

    // Generic Find Properties navigation should return to the active project.
    if (!queryProject && isProjectId(rememberedProject)) {
      const target = request.nextUrl.clone();
      target.searchParams.set("project", rememberedProject);
      return NextResponse.redirect(target);
    }

    if (isProjectId(queryProject)) {
      // A ranked Opportunity Engine handoff is explicit user intent and wins.
      if (rankedZip) {
        setActiveProjectCookie(response, queryProject);
        return response;
      }

      // The sidebar previously relied on stale client state. When returning from
      // Home, prefer the project already established by the project workspace /
      // ranked-ZIP handoff instead of allowing an older sidebar project ID to win.
      if (
        refererPath === "/" &&
        isProjectId(rememberedProject) &&
        queryProject !== rememberedProject
      ) {
        const target = request.nextUrl.clone();
        target.searchParams.set("project", rememberedProject);
        return NextResponse.redirect(target);
      }

      // Deliberate project navigation (for example from Projects or selector)
      // establishes the new active project.
      setActiveProjectCookie(response, queryProject);
    }
  }

  return response;
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
