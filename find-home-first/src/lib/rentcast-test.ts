/**
 * RentCast connection test — server/CLI only.
 *
 * Tests the RentCast API with a small query and reports:
 * - HTTP success/failure
 * - Number of rental results returned
 * - Whether listing contact data was present
 * - Whether one owner-detail lookup succeeded
 *
 * NEVER logs the API key or raw sensitive response data.
 *
 * Run: npx tsx src/lib/rentcast-test.ts
 */
import "dotenv/config";

const RENTCAST_BASE = "https://api.rentcast.io/v1";
const TEST_CITY = "Atlanta";
const TEST_STATE = "GA";
const TEST_LIMIT = 5;

function getApiKey(): string | null {
  const key = process.env.RENTCAST_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

async function testListings(): Promise<{
  ok: boolean;
  status?: number;
  count: number;
  hasContact: boolean;
  sampleId: string | null;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, count: 0, hasContact: false, sampleId: null, error: "RENTCAST_API_KEY not set" };
  }

  const url = new URL(`${RENTCAST_BASE}/listings/rental/long-term`);
  url.searchParams.set("city", TEST_CITY);
  url.searchParams.set("state", TEST_STATE);
  url.searchParams.set("status", "Active");
  url.searchParams.set("limit", String(TEST_LIMIT));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return {
      ok: false,
      count: 0,
      hasContact: false,
      sampleId: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      count: 0,
      hasContact: false,
      sampleId: null,
      error: `HTTP ${response.status}`,
    };
  }

  const data = (await response.json()) as unknown;
  const items: Array<Record<string, unknown>> = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : Array.isArray((data as Record<string, unknown>).listings)
    ? ((data as Record<string, unknown>).listings as Array<Record<string, unknown>>)
    : [];

  const hasContact = items.some(
    (i) => i.listedBy || i.listedByPhone || i.listedByEmail
  );
  const sampleId = items[0]?.id != null ? String(items[0].id) : null;

  return { ok: true, status: response.status, count: items.length, hasContact, sampleId };
}

async function testOwnerLookup(propertyId: string): Promise<{
  ok: boolean;
  hasOwnerName: boolean;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, hasOwnerName: false, error: "No key" };

  const url = `${RENTCAST_BASE}/properties/${encodeURIComponent(propertyId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return {
      ok: false,
      hasOwnerName: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (!response.ok) {
    return { ok: false, hasOwnerName: false, error: `HTTP ${response.status}` };
  }

  const data = (await response.json()) as Record<string, unknown>;
  const owner = data.owner as Record<string, unknown> | null | undefined;
  const hasOwnerName = !!(owner?.names || owner?.name);

  return { ok: true, hasOwnerName };
}

async function main() {
  const apiKey = getApiKey();
  console.log("─────────────────────────────────────────────────");
  console.log("RentCast API Connection Test");
  console.log("─────────────────────────────────────────────────");
  console.log(`API key configured: ${apiKey ? "yes (configured)" : "NO — RENTCAST_API_KEY not set"}`);
  console.log(`Test location: ${TEST_CITY}, ${TEST_STATE}`);
  console.log(`Limit: ${TEST_LIMIT} results`);
  console.log("─────────────────────────────────────────────────");

  // Test 1 — Rental listings
  console.log("\n[1] Testing GET /listings/rental/long-term …");
  const listResult = await testListings();

  if (!listResult.ok) {
    console.log(`    FAILED: ${listResult.error}`);
    if (listResult.status) console.log(`    HTTP status: ${listResult.status}`);
  } else {
    console.log(`    HTTP status: ${listResult.status} OK`);
    console.log(`    Results returned: ${listResult.count}`);
    console.log(`    Listing contact data present: ${listResult.hasContact}`);
    console.log(`    Sample property ID: ${listResult.sampleId ?? "(none returned)"}`);
  }

  // Test 2 — Owner lookup (only if listing returned an ID)
  if (listResult.ok && listResult.sampleId) {
    console.log(`\n[2] Testing GET /properties/${listResult.sampleId.slice(0, 8)}… (owner lookup) …`);
    const ownerResult = await testOwnerLookup(listResult.sampleId);

    if (!ownerResult.ok) {
      console.log(`    FAILED: ${ownerResult.error}`);
    } else {
      console.log(`    Owner lookup: OK`);
      console.log(`    Owner name field present: ${ownerResult.hasOwnerName}`);
    }
  } else {
    console.log("\n[2] Owner lookup skipped — no property ID from listing results.");
  }

  console.log("\n─────────────────────────────────────────────────");
  console.log(listResult.ok ? "Overall: CONNECTED" : "Overall: FAILED");
  console.log("─────────────────────────────────────────────────");

  if (!listResult.ok) process.exit(1);
}

main().catch((err) => {
  console.error("Test error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
