/**
 * Deterministic scoring engine.
 * Pure function — no DB, no network, no randomness.
 * Formula:
 *   HousingNeed × 25% + ProgramFundingFit × 25% + PropertyAvailability × 25%
 *   + ReferralReadiness × 15% + (100 − OperatingRisk) × 10%
 *
 * Operating Risk is INVERTED: higher OR score = higher risk = lower composite.
 */
import type { CollectedData, ScoringResult, ScorecardItem } from "./types";

// ─── Sub-scorers ──────────────────────────────────────────────────────────────

function scoreHousingNeed(data: CollectedData): ScorecardItem {
  const pit = data.pit.data;
  if (!pit || pit.totalHomeless === null) {
    // PIT is the preferred direct measure. When its CoC report has not yet
    // been matched, use clearly labelled ACS/CHAS vulnerability evidence so a
    // city is not falsely treated as having no housing need.
    const povertyRate = data.census.data?.povertyRatePct;
    if (povertyRate !== null && povertyRate !== undefined) {
      const pct = povertyRate * 100;
      const score = pct >= 25 ? 75 : pct >= 18 ? 65 : pct >= 12 ? 55 : 45;
      return {
        key: "housing_need",
        label: "Housing Need",
        numericScore: score,
        band: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low",
        weight: 0.25,
        weightedContribution: score * 0.25,
        reason: `Local PIT count is not yet matched; ACS poverty rate ${pct.toFixed(1)}% indicates housing vulnerability`,
        missingEvidence: "HUD CoC PIT count is still needed to verify the size and composition of the homeless population",
      };
    }

    const chas = data.chas.data;
    if (chas?.totalOccupied && chas.totalOccupied > 0) {
      const burden30 = chas.renterCostBurdened30pct ?? 0;
      const burden50 = chas.renterCostBurdened50pct ?? 0;
      if (burden30 > 0 || burden50 > 0) {
        const severeShare = burden50 / chas.totalOccupied;
        const score = severeShare >= 0.15 ? 65 : 55;
        return {
          key: "housing_need",
          label: "Housing Need",
          numericScore: score,
          band: "Medium",
          weight: 0.25,
          weightedContribution: score * 0.25,
          reason: `Local PIT count is not yet matched; HUD CHAS identifies ${burden30.toLocaleString()} cost-burdened and ${burden50.toLocaleString()} severely cost-burdened renter households`,
          missingEvidence: "HUD CoC PIT count is still needed to verify the size and composition of the homeless population",
        };
      }
    }

    return { key: "housing_need", label: "Housing Need", numericScore: null, band: "Unknown", weight: 0.25, weightedContribution: null, reason: "Verified local housing-need evidence is unavailable", missingEvidence: "HUD CoC PIT, Census poverty, or HUD CHAS housing-burden evidence is required" };
  }
  // Rate: homeless per 10,000 (Atlanta ~57/10k is High)
  const census = data.census.data;
  let score = 60; // default medium
  let reason = `${pit.totalHomeless.toLocaleString()} total homeless; ${pit.unsheltered != null ? Math.round((pit.unsheltered / pit.totalHomeless!) * 100) : "?"}% unsheltered`;
  if (census?.totalPopulation && census.totalPopulation > 0) {
    const rate = (pit.totalHomeless / census.totalPopulation) * 10000;
    if (rate >= 50) score = 85 + Math.min(10, Math.round((rate - 50) / 5));
    else if (rate >= 30) score = 70;
    else if (rate >= 15) score = 55;
    else score = 35;
    reason = `~${rate.toFixed(0)} homeless per 10,000 residents; ${pit.unsheltered != null ? Math.round((pit.unsheltered / pit.totalHomeless!) * 100) : "?"}% unsheltered`;
  } else {
    // Use absolute count as proxy
    if (pit.totalHomeless >= 2000) score = 85;
    else if (pit.totalHomeless >= 1000) score = 70;
    else if (pit.totalHomeless >= 500) score = 55;
    else score = 40;
  }
  if (pit.veterans !== null && pit.veterans > 100) {
    reason += `; ${pit.veterans2026Estimate ?? pit.veterans} homeless veterans`;
  }
  score = Math.min(100, Math.max(0, score));
  return { key: "housing_need", label: "Housing Need", numericScore: score, band: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low", weight: 0.25, weightedContribution: score * 0.25, reason, missingEvidence: null };
}

function scoreProgramFunding(data: CollectedData): ScorecardItem {
  const programs = data.vaPrograms.data?.programs ?? [];
  const bestImmediate = programs.filter((p) => p.fitRank === "Best Immediate").length;
  const hasFmr = data.fmr.data !== null;
  const fmrIsEstimate = data.fmr.source.isDerived;
  let score = 45;
  let reason = "Program funding fit pending local verification";
  let missingEvidence: string | null = null;

  if (bestImmediate >= 2 && hasFmr) {
    score = fmrIsEstimate ? 58 : 68;
    reason = fmrIsEstimate
      ? `${bestImmediate} best-immediate programs; statewide HUD FMR planning estimate $${data.fmr.data!.fourBr.toLocaleString()} (4BR), exact local benchmark pending`
      : `${bestImmediate} best-immediate programs (${programs.filter(p => p.fitRank === "Best Immediate").map(p => p.programName).join(", ")}); FMR $${data.fmr.data!.fourBr.toLocaleString()} (4BR) provides headroom`;
    missingEvidence = fmrIsEstimate
      ? "Exact local FMR area and local shared-housing rules not yet confirmed"
      : "Local shared-housing rules not yet confirmed";
  } else if (bestImmediate >= 1) {
    score = 52;
    reason = `${bestImmediate} best-immediate program available; local verification pending`;
    missingEvidence = "Local program acceptability not yet confirmed";
  }
  score = Math.min(100, Math.max(0, score));
  return { key: "program_funding_fit", label: "Program Funding Fit", numericScore: score, band: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low", weight: 0.25, weightedContribution: score * 0.25, reason, missingEvidence };
}

function scorePropertyAvailability(data: CollectedData): ScorecardItem {
  const fmr = data.fmr.data;
  const fmrIsEstimate = data.fmr.source.isDerived;
  const rc = data.rentcast.data;
  let score = 50;
  let reason = "Property availability pending local market research";
  const missingEvidence = fmrIsEstimate
    ? "Exact local FMR area not confirmed"
    : rc === null
      ? "RentCast market data not available — local inventory not confirmed"
      : null;

  if (fmr) {
    reason = fmrIsEstimate
      ? `Statewide HUD FMR median estimate $${fmr.fourBr.toLocaleString()} (4BR); exact local benchmark pending`
      : `FMR $${fmr.fourBr.toLocaleString()} (4BR) provides market benchmark`;
    score = fmrIsEstimate ? 50 : 60;
  }
  if (rc && rc.medianRent !== null && fmr && !fmrIsEstimate) {
    const headroom = fmr.fourBr - rc.medianRent;
    if (headroom > 500) { score = 72; reason = `FMR $${fmr.fourBr.toLocaleString()} (4BR) provides $${headroom.toFixed(0)} headroom over median rent $${rc.medianRent.toLocaleString()}`; }
    else if (headroom > 0) { score = 58; reason = `FMR $${fmr.fourBr.toLocaleString()} slightly above median rent $${rc.medianRent.toLocaleString()}`; }
    else { score = 35; reason = `Market rent $${rc.medianRent.toLocaleString()} exceeds FMR $${fmr.fourBr.toLocaleString()} — tight economics`; }
  }
  score = Math.min(100, Math.max(0, score));
  return { key: "property_availability", label: "Property Availability", numericScore: score, band: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low", weight: 0.25, weightedContribution: score * 0.25, reason, missingEvidence };
}

function scoreReferralReadiness(): ScorecardItem {
  // Always low until active referral relationships are confirmed
  const score = 35;
  return {
    key: "referral_readiness",
    label: "Referral Readiness",
    numericScore: score,
    band: "Low",
    weight: 0.15,
    weightedContribution: score * 0.15,
    reason: "Providers appear in VA directory; no confirmed active referral relationship",
    missingEvidence: "Active referral relationship not yet confirmed",
  };
}

function scoreOperatingRisk(data: CollectedData): ScorecardItem {
  // Risk is high when shared-housing is unverified, lease structure unknown
  // OR score 67 = moderate-high risk (inverted: (100-67)*10% = 3.3 points)
  const programs = data.vaPrograms.data?.programs ?? [];
  const allUnverified = programs.every((p) => p.sharedHousingCompatibility.includes("Not Verified"));
  const score = allUnverified ? 75 : 60;
  return {
    key: "operating_risk",
    label: "Operating Risk",
    numericScore: score,
    band: score >= 70 ? "High" : "Medium",
    weight: 0.10,
    weightedContribution: (100 - score) * 0.10,
    reason: allUnverified
      ? "Shared-housing locally unverified; sublease structure unverified; inspection requirements unknown"
      : "Some program requirements verified; sublease structure needs confirmation",
    missingEvidence: null,
  };
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreMarket(data: CollectedData): ScoringResult {
  const hn = scoreHousingNeed(data);
  const pf = scoreProgramFunding(data);
  const pa = scorePropertyAvailability(data);
  const rr = scoreReferralReadiness();
  const or = scoreOperatingRisk(data);

  const scorecard = [hn, pf, pa, rr, or];

  // Only stop scoring when no defensible housing-need measure or proxy exists.
  if (hn.numericScore === null || pf.numericScore === null || pa.numericScore === null) {
    return {
      overallScore: null,
      confidence: "insufficient_data",
      verdict: "Insufficient Evidence",
      verdictExplanation: "Verified local housing-need evidence was unavailable. The report will not guess a homelessness count or market verdict without PIT, Census poverty, or HUD CHAS evidence.",
      scorecard,
      bestTargetPopulation: "Pending data collection",
      bestProgramOpportunity: "Pending verification",
      largestBlocker: "No verified local housing-need measure or defensible proxy was available",
      primaryNextAction: "Verify the city and state, then update the report to collect local housing-need evidence",
      primaryNextActionButton: "Re-run Market Analysis",
    };
  }

  const composite =
    hn.numericScore * 0.25 +
    pf.numericScore * 0.25 +
    pa.numericScore * 0.25 +
    (rr.numericScore ?? 0) * 0.15 +
    (100 - (or.numericScore ?? 67)) * 0.10;

  const overallScore = Math.round(composite);
  const allHigh = data.pit.status === "ok" && data.fmr.status === "ok";
  const confidence = allHigh ? "medium" : "low";

  let verdict: ScoringResult["verdict"];
  let verdictExplanation: string;
  if (overallScore >= 75) {
    verdict = "Go";
    verdictExplanation = "Evidence strongly supports proceeding. Resolve all outstanding verification items before signing any lease.";
  } else if (overallScore >= 50) {
    verdict = "Conditional Go";
    verdictExplanation = "The opportunity appears promising. Proceed only after confirming local shared-housing acceptability, master-lease or sublease structure, referral process, and payment standards with the relevant program administrators.";
  } else {
    verdict = "No-Go";
    verdictExplanation = "Current market conditions do not support this opportunity. Specific barriers must be resolved before reconsidering.";
  }

  const programs = data.vaPrograms.data?.programs ?? [];
  const bestProgram = programs.find((p) => p.fitRank === "Best Immediate");

  return {
    overallScore,
    confidence,
    verdict,
    verdictExplanation,
    scorecard,
    bestTargetPopulation: "Single adult veterans",
    bestProgramOpportunity: bestProgram ? `${bestProgram.programName} (${bestProgram.sharedHousingCompatibility.split(" — ")[0]})` : "Pending verification",
    largestBlocker: "Local shared-housing arrangement not verified with any program provider",
    primaryNextAction: bestProgram?.localAdminOrg
      ? `Contact ${bestProgram.localAdminOrg} to confirm shared-housing eligibility and referral intake process`
      : "Contact local VA Medical Center HUD-VASH coordinator to confirm shared-housing eligibility",
    primaryNextActionButton: bestProgram?.localAdminOrg
      ? `Contact ${bestProgram.localAdminOrg}`
      : "Contact Local VAMC HUD-VASH Coordinator",
  };
}
