<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Find Home First engineering protocol

## Protect the working tree

- Start every change with `git status --short --branch` and a targeted `git diff`.
- Treat unrelated local changes as user-owned. Do not overwrite, discard, or mix them into a feature commit.
- Keep commits focused enough that the changed behavior can be reviewed and rolled back independently.
- Before merging, compare the branch with current `main`: confirm ahead/behind counts and the exact changed-file list. Never merge a stale branch merely because its code change is good. If a branch is materially behind, transplant only the intended commits/files onto a fresh branch from current `main`.

## Evidence and fallback rules

- Prefer current primary government or provider data over copied summaries.
- Use this hierarchy for geographic evidence: exact municipality or program area, then county/metro, then a clearly labelled regional or statewide estimate, then unavailable.
- Never present a derived estimate as an exact local fact. Mark it in the web report, PDF, Excel, source record, and scoring confidence.
- Do not substitute one metric for another: HUD FMR is a rent benchmark, not a guaranteed program payment standard; listing rent is not FMR; a program rule still requires confirmation from that program.
- Preserve usable collected data when one source fails. Give the user a concrete retry action instead of instructing them to manually collect public data the application can retrieve.
- Do not change scoring or weighting to compensate for missing source data. First prove whether the raw inputs are present, valid, and different where expected; only then investigate normalization/scoring.

## External API and collector rules

- `response.ok` is not proof that a provider returned valid data. Validate the expected `Content-Type` and response shape before parsing. Providers can return HTTP 200 with HTML or an error page.
- Never silently convert a required-source failure into `null`. Preserve a safe diagnostic containing the provider/status/failure class while never exposing secrets.
- An environment variable being present is not proof that a credential is usable. Production acceptance must distinguish **configured**, **activated/valid**, and **successfully returning expected data**.
- When a credential or provider response fails, surface the collector status/error through persisted diagnostics that can be read after the run. Do not rely only on transient logs.
- Use deterministic mocks for error modes such as HTML-on-200, non-200 responses, timeouts, partial success, and parse failures.

## Production debugging discipline

- Do not repeat the same failed action expecting a different result. After the same test reproduces the same failure, stop and inspect a new layer of evidence: HTTP status/body, persisted job/report state, collector status/error, runtime configuration, or downstream saved state.
- Separate these questions during diagnosis: **Was the request accepted? Did a new job/report actually run? Did the collector obtain valid inputs? Did scoring consume those inputs? Did the UI render the new result?** Do not collapse them into one assumption.
- Treat 409/429 responses as failed or deferred actions, not successful refreshes. A UI that restores an older report after an error must not be interpreted as proof that regeneration occurred.
- Before changing UI diagnostics, identify the exact active production route and rendered component. Do not patch a dormant, legacy, or parallel screen just because it has a similar name.
- Prefer diagnostics on the actual workflow screen or its existing API response so the operator can see the saved truth without browser-console work.
- If a source-coverage, interpretation, or report-generation change makes existing saved reports semantically stale, increment the report/data engine version or otherwise invalidate the old artifact. Code deployment alone does not make persisted reports new.

## Workflow handoff rules

- Explicit navigation context from the current workflow outranks stale saved-draft state. If a ranked ZIP/project is handed into Housing Search, all correlated geography needed for a coherent search must come from that current project/report.
- Update dependent fields as a unit. Never allow a new ZIP to remain paired with an unrelated saved city/state, map center, result snapshot, or query fingerprint.
- When a handoff intentionally changes search context, clear stale result/map state that could make old data appear to belong to the new target.
- Acceptance-test the destination values, not just the URL. Verify the same project, selected ZIP, city/state, and intended search scope after navigation.

## Required verification before release

- Use repository-local executables (`./node_modules/.bin/...`) when available so validation does not depend on an `npx` download or prompt.
- Required gates for application changes: TypeScript, lint, full tests, `git diff --check`, and a production Next.js build.
- Run `db:check` for schema or migration work. Test additive migrations in an isolated schema before production and verify the live schema after deployment.
- A successful homepage health check or Railway deployment is not feature verification. Exercise the changed route, action, export, data result, and downstream handoff after deployment.
- For data-driven features, acceptance should prove three separate gates when applicable: **source ingestion/raw inputs**, **business output/confidence**, and **downstream workflow handoff**.
- Never call a paid external API merely to prove code that can be tested with deterministic mocks. When a live call is necessary, state the expected call count first and record only safe metadata.

## Secrets and reporting

- Read credentials only from server-side environment variables. Never print, partially reveal, return, persist, or place them in public URLs.
- Release reports must distinguish what was tested locally, what was verified live, and what remains unverified. Do not call a feature production-ready based only on code inspection or a successful deployment.
- Report durable evidence: commit/PR, deployment result, migration result when applicable, exact verification gates, and feature-specific live proof. Avoid long activity logs that do not help reproduce or audit the release.
