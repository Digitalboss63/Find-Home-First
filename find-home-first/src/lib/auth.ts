/**
 * Server-only auth helpers.
 * Import ONLY in server components, server actions, and route handlers.
 * Never import in "use client" files.
 */
import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users, organizationMemberships } from "@/db/schema";

export interface AuthUser {
  clerkUserId: string;
  dbUserId: string;
  email: string | null;
  name: string | null;
}

export interface AuthContext {
  user: AuthUser;
  organizationId: string;
  role: "owner" | "staff";
}

/** Asserts Clerk auth. Returns clerkUserId or redirects. */
export async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

/**
 * Asserts auth + organization membership.
 * organizationId is ALWAYS from the server session — never client-supplied.
 */
export async function requireOrganization(): Promise<AuthContext> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") redirect("/unavailable");
    throw new Error("[auth] Database unavailable — set DATABASE_URL");
  }

  // Get or create user record
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  let dbUser = userRows[0] ?? null;

  if (!dbUser) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
    const name = clerkUser?.fullName ?? clerkUser?.firstName ?? null;
    const inserted = await db
      .insert(users)
      .values({ clerkUserId: userId, email, name })
      .returning();
    dbUser = inserted[0];
  }

  // Look up membership
  const membershipRows = await db
    .select({
      organizationId: organizationMemberships.organizationId,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, dbUser.id))
    .limit(1);

  if (membershipRows.length === 0) redirect("/onboarding");

  const membership = membershipRows[0];
  return {
    user: {
      clerkUserId: userId,
      dbUserId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
    },
    organizationId: membership.organizationId,
    role: membership.role as "owner" | "staff",
  };
}

/** Asserts owner role. Staff → redirect /access-denied. */
export async function requireRole(
  ctx: AuthContext,
  requiredRole: "owner"
): Promise<void> {
  if (ctx.role !== requiredRole) redirect("/access-denied");
}
