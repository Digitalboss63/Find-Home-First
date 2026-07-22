/**
 * Shared view types — safe to import from both server and client code.
 * No database imports. No server-only imports.
 */

/** Normalised property record used by HousingSearchClient. */
export interface PropertyItemView {
  id: string;
  address: string;
  community: string;
  bedrooms: number;
  /** Parsed to a number so the client can do numeric comparisons. */
  monthlyRent: number;
  /** ISO date string "YYYY-MM-DD" */
  availableDate: string;
  /** Free-text landlord / owner contact. Empty string when unavailable. */
  landlordContact: string;
  notes: string;
}
