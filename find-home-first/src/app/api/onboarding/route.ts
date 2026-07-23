import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { organizations, users, organizationMemberships } from "@/db/schema";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgName = typeof body.name === "string" ? body.name.trim() : "";
  if (!orgName || orgName.length > 120) {
    return NextResponse.json({ error: "Organization name is required (max 120 characters)" }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });

  try {
    const existingUsers = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
    let dbUser = existingUsers[0] ?? null;

    if (!dbUser) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
      const name = clerkUser?.fullName ?? clerkUser?.firstName ?? null;
      const inserted = await db.insert(users).values({ clerkUserId: userId, email, name }).returning();
      dbUser = inserted[0];
    }

    const existingMembership = await db.select().from(organizationMemberships).where(eq(organizationMemberships.userId, dbUser.id)).limit(1);
    if (existingMembership.length > 0) {
      return NextResponse.json({ error: "You already belong to an organization" }, { status: 409 });
    }

    const orgInserted = await db.insert(organizations).values({ name: orgName }).returning();
    const org = orgInserted[0];
    await db.insert(organizationMemberships).values({ organizationId: org.id, userId: dbUser.id, role: "owner" });

    return NextResponse.json({ organizationId: org.id }, { status: 201 });
  } catch (err) {
    console.error("[onboarding] Failed:", err);
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
}
