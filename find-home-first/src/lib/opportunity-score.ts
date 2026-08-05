/**
 * Opportunity score calculator for property leads.
 *
 * Deterministic, explainable, evidence-only.
 * Only uses signals actually returned by RentCast.
 * Never labels an owner "distressed" or "tired".
 *
 * Score: 0-100 (higher = stronger evidence of lease opportunity).
 * Each signal shows its weight and whether the data was available.
 */

import type { RentCastListing, RentCastOwner } from "./rentcast";

export interface OpportunitySignal {
  key: string;
  label: string;
  points: number;     // max points this signal can contribute
  earned: number;     // actual points earned
  available: boolean; // was data available to evaluate this signal?
  value: string | null; // human-readable evidence value
}

export interface OpportunityResult {
  score: number;          // 0-100
  signals: OpportunitySignal[];
  maxPossible: number;    // sum of all signal points (available or not)
}

const WEIGHTS = {
  inactive_listing:   25,
  long_days_listed:   20,
  non_owner_occupied: 20,
  mailing_differs:    15,
  individual_owner:   10,
  vacancy_evidence:   10,
} as const;

const LONG_DAYS_THRESHOLD = 30;

function finalizeScore(signals: OpportunitySignal[]): OpportunityResult {
  const totalEarned = signals.reduce((s, x) => s + x.earned, 0);
  const totalPossible = signals.reduce((s, x) => s + x.points, 0);
  const score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  return { score, signals, maxPossible: totalPossible };
}

/**
 * Computes opportunity score from listing data alone (no owner API call needed).
 * Use this to show pre-enrichment signals on every listing card.
 */
export function scoreFromListing(listing: RentCastListing): OpportunityResult {
  const signals: OpportunitySignal[] = [];

  // Inactive / stale listing
  const statusLower = listing.status?.toLowerCase() ?? null;
  const isInactive = statusLower === "inactive" || statusLower === "off market";
  signals.push({
    key: "inactive_listing",
    label: "Inactive or off-market listing",
    points: WEIGHTS.inactive_listing,
    earned: isInactive ? WEIGHTS.inactive_listing : 0,
    available: listing.status !== null,
    value: listing.status,
  });

  // Long days on market
  const dom = listing.daysOnMarket;
  const isLong = dom !== null && dom > LONG_DAYS_THRESHOLD;
  signals.push({
    key: "long_days_listed",
    label: `Listed more than ${LONG_DAYS_THRESHOLD} days`,
    points: WEIGHTS.long_days_listed,
    earned: isLong ? WEIGHTS.long_days_listed : 0,
    available: dom !== null,
    value: dom !== null ? `${dom} days` : null,
  });

  // Owner signals — not yet available
  signals.push(
    { key: "non_owner_occupied", label: "Non-owner-occupied", points: WEIGHTS.non_owner_occupied, earned: 0, available: false, value: null },
    { key: "mailing_differs", label: "Owner mailing address differs from property", points: WEIGHTS.mailing_differs, earned: 0, available: false, value: null },
    { key: "individual_owner", label: "Individual owner (not corporate)", points: WEIGHTS.individual_owner, earned: 0, available: false, value: null },
    { key: "vacancy_evidence", label: "Vacant property evidence", points: WEIGHTS.vacancy_evidence, earned: 0, available: false, value: null },
  );

  return finalizeScore(signals);
}

/**
 * Enriches an existing score with owner data after RentCast enrichment.
 * Replaces the placeholder signals with actual evidence.
 */
export function enrichScoreWithOwner(
  listing: RentCastListing,
  owner: RentCastOwner,
  occupancyStatus?: string | null
): OpportunityResult {
  const signals: OpportunitySignal[] = [];

  // Re-evaluate listing signals
  const statusLower = listing.status?.toLowerCase() ?? null;
  const isInactive = statusLower === "inactive" || statusLower === "off market";
  signals.push({
    key: "inactive_listing",
    label: "Inactive or off-market listing",
    points: WEIGHTS.inactive_listing,
    earned: isInactive ? WEIGHTS.inactive_listing : 0,
    available: listing.status !== null,
    value: listing.status,
  });

  const dom = listing.daysOnMarket;
  const isLong = dom !== null && dom > LONG_DAYS_THRESHOLD;
  signals.push({
    key: "long_days_listed",
    label: `Listed more than ${LONG_DAYS_THRESHOLD} days`,
    points: WEIGHTS.long_days_listed,
    earned: isLong ? WEIGHTS.long_days_listed : 0,
    available: dom !== null,
    value: dom !== null ? `${dom} days` : null,
  });

  // Owner signals
  const nonOwnerOcc = owner.ownerOccupied === false;
  signals.push({
    key: "non_owner_occupied",
    label: "Non-owner-occupied",
    points: WEIGHTS.non_owner_occupied,
    earned: nonOwnerOcc ? WEIGHTS.non_owner_occupied : 0,
    available: owner.ownerOccupied !== null,
    value: owner.ownerOccupied !== null ? (owner.ownerOccupied ? "Owner-occupied" : "Non-owner-occupied") : null,
  });

  signals.push({
    key: "mailing_differs",
    label: "Owner mailing address differs from property",
    points: WEIGHTS.mailing_differs,
    earned: owner.mailingDiffersFromProperty ? WEIGHTS.mailing_differs : 0,
    available: owner.mailingAddress !== null,
    value: owner.mailingAddress ?? null,
  });

  const isIndividual = owner.ownerType?.toLowerCase() === "individual";
  signals.push({
    key: "individual_owner",
    label: "Individual owner (not corporate)",
    points: WEIGHTS.individual_owner,
    earned: isIndividual ? WEIGHTS.individual_owner : 0,
    available: owner.ownerType !== null,
    value: owner.ownerType ?? null,
  });

  const isVacant = occupancyStatus?.toLowerCase() === "vacant";
  signals.push({
    key: "vacancy_evidence",
    label: "Vacant property evidence",
    points: WEIGHTS.vacancy_evidence,
    earned: isVacant ? WEIGHTS.vacancy_evidence : 0,
    available: occupancyStatus !== null && occupancyStatus !== undefined,
    value: occupancyStatus ?? null,
  });

  return finalizeScore(signals);
}
