# Changelog

## [Unreleased]

### In-app guidance and knowledge system

- Added a shared Find Home First knowledge repository covering getting started, projects/statuses, market intelligence, Opportunity Score, FMR, property search/economics, landlord outreach, referral contacts, prospective residents, tasks, and plan/billing guidance.
- Added a searchable **Help Center** to the operator navigation with expandable instructions, required information, common mistakes, next actions, and per-topic video slots.
- Added **FHF Guide**, a context-aware help panel available throughout the operator app. It recognizes the current route, suggests relevant topics, searches the shared knowledge repository, and links users directly to the applicable workflow screen.
- Added project-aware guidance backed by the signed-in organization’s actual project data: current stage, recorded blocker, saved-property count, open tasks, missing required information, and the next workflow action.
- Reused the existing market-research approval validator so FHF Guide reports the same missing research requirements that govern city approval instead of maintaining a second definition of completion.
- Added direct project questions for **What do I do now?**, **What’s blocking me?**, and **What’s missing?** with direct links to the recommended workflow screen.
- Prepared every help topic for future training-video URLs so one knowledge record can power the Help Center, FHF Guide, and video access without duplicated content.
- Kept project guidance deterministic and auditable for this phase; external-LLM reasoning and guided **Show Me** interaction remain follow-on work.

## [1.0.0] - 2026-09-03

### Production release

- Promoted Find Home First to its first production-ready release after live acceptance of authentication, billing, Back Office, refund, cancellation, and application-return workflows.
- Locked application package version at `1.0.0` and recorded the production acceptance evidence in `docs/releases/v1.0.0-production-acceptance.md`.
- Production no longer presents the normal application as a demonstration environment.

### Authentication and owner access

- Completed Clerk Production configuration for the live Find Home First domain.
- Verified live Google sign-in end to end using the production Clerk connection and a dedicated Google OAuth Web application client.
- Verified the production platform-owner identity and owner-only Back Office access.
- Added a permanent production-authentication release gate covering Clerk production credentials, social-provider callback registration, production owner identity, owner-only Back Office access, and normal-user access.
- Added the reusable `docs/production-auth-release-checklist.md` release checklist.

### Billing and support controls

- Added live monthly Stripe subscriptions for Find Home First Tier 1 and Tier 2.
- Added organization-level billing persistence, subscription access gating, Stripe Checkout, and signed webhook processing for subscription lifecycle events.
- Added a protected Stripe Customer Portal flow so organization owners can manage billing from Plan & Billing.
- Added a support-only Billing Support console for the platform owner and explicitly authorized support staff.
- Added full and partial Stripe refunds with confirmation, support reason/note capture, charge-to-organization ownership verification, and audit logging.
- Added optional immediate subscription cancellation as part of the authorized support workflow while preserving customer self-cancellation through Stripe.
- Verified a live $1 acceptance purchase activated Tier 1 through the Stripe webhook.
- Verified Back Office Billing Support issued the full $1 refund, reduced the remaining refundable amount to $0.00, and canceled the related test subscription.

### Back Office and operations

- Consolidated billing support inside Back Office.
- Added a prominent **Return to App** control on desktop and mobile Back Office layouts.
- Preserved owner-only administrative navigation while allowing explicitly authorized billing-support staff access only to Billing Support.
- Refund and cancellation operations are recorded through the Find Home First audit workflow.

### Release quality

- Production auth, owner access, live billing activation, refund, cancellation, and Back Office navigation were accepted in production before the v1.0.0 scope lock.
- TypeScript, lint, full tests, Drizzle schema validation, diff checks, and production Next.js builds remained required merge gates throughout the release.
- New feature work is intentionally deferred to a subsequent version; v1.0.0 is scope-locked as the first completed production release.

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

### Production acceptance completed - 2026-08-23

- Confirmed live Census ACS ZIP Veteran inputs now vary by Atlanta ZIP and feed the Opportunity Engine; ranked rows moved from neutral fallback/`ESTIMATED` to differentiated Veteran Need scores with `MEDIUM` confidence.
- Hardened the Census ZCTA collector so HTTP 200 HTML/error responses are detected and surfaced instead of disappearing as silent `null` fallbacks.
- Added persisted/visible Census diagnostics to distinguish missing/invalid credentials from scoring issues; production testing identified an unactivated Census API key as the actual credential failure.
- Incremented the report engine version so source-coverage changes invalidate semantically stale saved reports instead of leaving old output behind a freshness cooldown.
- Fixed ranked-ZIP Housing Search handoff so explicit project/ZIP context refreshes city/state and clears stale saved result/map state; verified Atlanta, GA + ZIP 30314 in production.
- Added engineering protocol rules for stale-branch protection, non-JSON API responses, credential activation/validity checks, no-repeat debugging, active-route verification, report invalidation, and coherent downstream handoffs.

### Controlled beta acceptance completed - 2026-09-02

- Verified the production workflow from ranked ZIP targeting into property search, saved lead handling, owner enrichment, and Owner Outreach.
- Fixed saved-lead owner handoff so cached RentCast owner data is restored and persisted when the outreach workspace opens.
- Persisted the owner-enriched opportunity score so the saved lead workspace matches the evidence shown during owner lookup.
- Updated RentCast normalization to current `listedDate`, `listingAgent`, and `listingOffice` response fields while preserving legacy fallbacks.
- Versioned saved property-result snapshots so normalizer changes invalidate stale cached results without disabling paid-result caching.
- Preserved Next.js framework redirects with `unstable_rethrow`, preventing internal `NEXT_REDIRECT` exceptions from appearing as user-facing errors.
- Added saved-lead self-healing from the latest normalized RentCast snapshot so current listing dates and listing-contact details reach existing leads without another API request or overwriting workflow data.
- Verified production listing contact handoff with a real saved lead: listing contact name, phone, and email display separately from property-owner identity and remain explicitly unverified as owner data.
- Removed the temporary `/housing-search/diagnostic`, `/housing-search/schema-check`, and `/housing-search/write-check` production routes before the controlled beta release.

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
