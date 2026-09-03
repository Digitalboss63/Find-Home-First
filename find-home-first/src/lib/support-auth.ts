import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export interface BillingSupportActor {
  clerkUserId: string;
  email: string | null;
  name: string | null;
  isPlatformOwner: boolean;
}

function configuredSupportUserIds(): Set<string> {
  return new Set(
    (process.env.BILLING_SUPPORT_CLERK_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

/**
 * High-privilege billing-support guard.
 *
 * Access is limited to the platform owner plus Clerk user IDs explicitly listed
 * in BILLING_SUPPORT_CLERK_USER_IDS. Organization owner/staff roles do not grant
 * access to refunds or cross-customer billing data.
 */
export async function requireBillingSupport(): Promise<BillingSupportActor> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const platformOwnerId = process.env.PLATFORM_OWNER_CLERK_USER_ID?.trim();
  const isPlatformOwner = !!platformOwnerId && userId === platformOwnerId;
  const isSupportUser = configuredSupportUserIds().has(userId);

  if (!isPlatformOwner && !isSupportUser) {
    redirect("/access-denied");
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
  const name = user?.fullName ?? user?.firstName ?? null;

  return {
    clerkUserId: userId,
    email,
    name,
    isPlatformOwner,
  };
}
