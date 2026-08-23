# Changelog

## [0.3.0] - 2026-08-22

### Added

- Property Opportunity Engine V1.2 with ranked ZIP/ZCTA targeting for Veteran housing opportunities.
- Weighted scoring across Veteran Housing Need (40%), Placement Infrastructure (20%), Housing Economics (25%), and Property Availability (15%).
- Census ACS ZIP Veteran demographics, regional HUD Veteran homelessness context, RentCast inventory inputs, and FMR-based economics screening without treating FMR as guaranteed program payment.
- Persisted opportunity-score inputs and calculation metadata for auditability.
- City/CoC geographic fallback when ZIP-level ranking cannot be produced from current inventory.
- Direct **Find Properties** handoff from ranked ZIPs into Housing Search.
- Property Showing Workflow and Owner Outreach Playbook V1.

### Changed

- Ranked-ZIP handoff now overrides stale saved Housing Search geography and clears stale result/map state before a new ZIP-targeted search.
- Opportunity scoring no longer uses a fixed three-room assumption or treats 1BR FMR as per-room revenue.
- Program-specific payment standards remain separate from HUD FMR and must be confirmed with the applicable administrator.

### Quality

- Opportunity scores are persisted to `market_opportunity_scores` with source geography, confidence, estimated status, calculation version, and raw/normalized scoring evidence.
- Migration `0010_opportunity-engine` is registered in the Drizzle migration journal and Railway runs database migrations before deployment.
- Fixed production TypeScript null-safety failures around optional ZIP demographics.
- Railway production deployment passed after the Opportunity Engine build fixes; final v0.3.0 acceptance deployment validates the ZIP handoff and migration registration changes.

## [0.2.0] - 2026-08-20

### Added

- Automatic nationwide HUD Fair Market Rent collection using exact municipality, county, or metro data when available.
- A clearly labelled statewide HUD median planning estimate for small municipalities that cannot be matched to an exact HUD area.
- Official FY2026 Philadelphia FMR fallback values from HUD's published schedule.
- FMR geography, reporting period, and estimate status across the online report, PDF, Excel workbook, and source records.
- Engineering release controls for worktree safety, authoritative data fallbacks, verification gates, secrets, and feature-specific production proof.

### Changed

- City reports now tell users to update the report when HUD collection is temporarily unavailable instead of asking them to collect public FMR data manually.
- Market scoring reduces confidence and avoids exact rent-headroom calculations when only a statewide estimate is available.
- Program-specific per-room payment standards remain explicitly separate from HUD FMR benchmarks and require confirmation from the relevant program administrator.

### Quality

- Added deterministic coverage for Philadelphia, exact small-municipality matches, statewide estimates, source labeling, and estimate-aware scoring.
- Verified with TypeScript, lint, the full automated test suite, Drizzle schema validation, diff checks, and a production Next.js build.
