# Changelog

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
