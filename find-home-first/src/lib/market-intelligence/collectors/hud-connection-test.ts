/**
 * HUD API connection test.
 *
 * Server-only. Reports connection status without revealing the token.
 *
 * Result includes only:
 *   - connected: boolean
 *   - httpStatus: number
 *   - dataset: string
 *   - geography: string (from API response)
 *   - reportingYear: string
 *   - testedAt: ISO string
 *
 * The token is NEVER included in any result field or log line.
 */

export interface HudConnectionTestResult {
  connected: boolean;
  httpStatus: number | null;
  dataset: string;
  geography: string | null;
  reportingYear: string | null;
  testedAt: string;
  error?: string;
}

export interface HudConnectionTestConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  hudToken?: string;
}

/**
 * Tests the HUD User API connection using the FMR list-states endpoint
 * (lightweight, no geography params required).
 * Never logs or returns the token.
 */
export async function testHudConnection(
  config: HudConnectionTestConfig = {}
): Promise<HudConnectionTestResult> {
  const {
    fetchFn = fetch,
    timeoutMs = 8000,
    hudToken = process.env.HUD_TOKEN,
  } = config;
  const testedAt = new Date().toISOString();

  if (!hudToken) {
    return {
      connected: false,
      httpStatus: null,
      dataset: "HUD Fair Market Rents",
      geography: null,
      reportingYear: null,
      testedAt,
      error: "HUD_TOKEN not configured",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let httpStatus: number | null = null;

  try {
    // Use listStates — lightweight, token-gated, no sensitive params
    const res = await fetchFn("https://www.huduser.gov/hudapi/public/fmr/listStates", {
      headers: { Authorization: `Bearer ${hudToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    httpStatus = res.status;

    if (!res.ok) {
      return {
        connected: false,
        httpStatus,
        dataset: "HUD Fair Market Rents — listStates",
        geography: null,
        reportingYear: null,
        testedAt,
        error: `HTTP ${httpStatus}`,
      };
    }

    const json = await res.json() as unknown;
    // Extract a representative geography from the response without logging internals
    let geography: string | null = null;
    let reportingYear: string | null = null;
    if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      const data = Array.isArray(obj["data"]) ? obj["data"] : null;
      if (data && data.length > 0) {
        const first = data[0] as Record<string, unknown>;
        geography = typeof first["state_name"] === "string" ? first["state_name"] : null;
      }
      if (obj["year"]) reportingYear = String(obj["year"]);
    }

    return {
      connected: true,
      httpStatus,
      dataset: "HUD Fair Market Rents — listStates",
      geography,
      reportingYear,
      testedAt,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error
      ? (err.name === "AbortError" ? "Request timed out" : err.message)
      : "Network error";
    return {
      connected: false,
      httpStatus,
      dataset: "HUD Fair Market Rents — listStates",
      geography: null,
      reportingYear: null,
      testedAt,
      error: msg,
    };
  }
}
