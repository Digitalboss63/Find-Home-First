"use server";

/**
 * Back Office — System Health server actions.
 *
 * SECURITY: RENTCAST_API_KEY is NEVER returned in any response, log, or error.
 * Rate limit: 3 tests per user per minute.
 */
import { requirePlatformOwner } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  searchRentalListings,
  getOwnerByPropertyId,
  isRentCastConfigured,
} from "@/lib/rentcast";

export interface RentCastTestResult {
  connected: boolean;
  httpStatus: number | null;
  resultCount: number;
  hasListingContact: boolean;
  hasOwnerLookup: boolean;
  testedAt: string;
  error?: string;
}

export async function testRentCastAction(): Promise<RentCastTestResult> {
  const { clerkUserId } = await requirePlatformOwner();

  // Rate limit: 3 per minute per platform owner
  const rl = checkRateLimit(`rentcast-test:${clerkUserId}`, 3);
  if (!rl.allowed) {
    return {
      connected: false,
      httpStatus: null,
      resultCount: 0,
      hasListingContact: false,
      hasOwnerLookup: false,
      testedAt: new Date().toISOString(),
      error: `Rate limit exceeded. Try again in ${rl.resetInSeconds} seconds.`,
    };
  }

  if (!isRentCastConfigured()) {
    return {
      connected: false,
      httpStatus: null,
      resultCount: 0,
      hasListingContact: false,
      hasOwnerLookup: false,
      testedAt: new Date().toISOString(),
      error: "RENTCAST_API_KEY is not configured.",
    };
  }

  const testedAt = new Date().toISOString();

  // Test 1: search listings
  const listResult = await searchRentalListings({
    city: "Atlanta",
    state: "GA",
    status: "Active",
    limit: 5,
  });

  if (listResult.error) {
    // Parse HTTP status from error message if present
    const statusMatch = listResult.error.match(/HTTP (\d+)/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : null;
    return {
      connected: false,
      httpStatus,
      resultCount: 0,
      hasListingContact: false,
      hasOwnerLookup: false,
      testedAt,
      error: listResult.error,
    };
  }

  const hasListingContact = listResult.listings.some(
    (l) => l.listedBy || l.listedByPhone || l.listedByEmail
  );

  // Test 2: owner lookup (lazy — only if we got a listing with an ID)
  let hasOwnerLookup = false;
  if (listResult.listings[0]?.id) {
    const ownerResult = await getOwnerByPropertyId(listResult.listings[0].id);
    hasOwnerLookup = !ownerResult.error && ownerResult.owner !== null;
  }

  return {
    connected: true,
    httpStatus: 200,
    resultCount: listResult.listings.length,
    hasListingContact,
    hasOwnerLookup,
    testedAt,
  };
}
