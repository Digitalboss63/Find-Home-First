<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Find Home First engineering protocol

## Execution ownership rule

- Never hand work to OC, Codex, Claude, or another coding agent when the current assistant can complete the task with the tools, repository access, permissions, and execution environment already available.
- Before recommending an OC handoff, first use the available tools and attempt the work directly when it is within current capability.
- Use OC only when the required work cannot actually be completed with the current assistant's available tools or permissions, or when the user explicitly asks for OC.
- If OC is genuinely required, say so immediately and give the user the exact handoff prompt without a long explanation.

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

## Production authentication and owner-access gate

Run this gate every time a Clerk-backed app is promoted from development/test to production, whenever a production Clerk instance is recreated, or whenever domains/auth providers change. Do not call the release production-ready until every item below is verified live.

- **Production Clerk instance:** confirm the live site is using the Production instance, not Development. Use the production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the production runtime and redeploy after changing them.
- **Production domains/DNS:** verify the primary custom domain in Clerk and all required Clerk DNS records before testing sign-in. Also verify the application apex and `www` records still resolve to the hosting provider after Clerk DNS changes.
- **Platform owner identity:** Clerk Development and Production user IDs are different identities. Copy the actual Production Clerk User ID for the platform owner and set `PLATFORM_OWNER_CLERK_USER_ID` in production. Never carry a development user ID into production. Verify the owner-only Back Office link is visible after redeploy and that `/back-office` opens successfully.
- **Support identity:** when billing-support users are enabled, use Production Clerk user IDs in `BILLING_SUPPORT_CLERK_USER_IDS`; development IDs are invalid in production.
- **Google OAuth custom credentials:** production Clerk instances must use the production Google OAuth client credentials configured in Clerk. Do not rely on development/shared credentials.
- **Google callback URI:** copy the **Authorized Redirect URI shown by the active Clerk Production Google connection** and add that exact URI to the matching Google Cloud OAuth 2.0 Web application under **Authorized redirect URIs**. Do not infer or reuse an old callback URI. Any Clerk custom-domain change can change this URI.
- **Google origins:** add the production application origins used by the app (for example apex and `www`, when both are supported) to the Google OAuth Web client where required.
- **Google consent/publishing:** verify the Google OAuth consent configuration is appropriate for production use and not accidentally restricted to a temporary testing audience.
- **Live acceptance:** test both the normal email sign-in path and Google sign-in on the real production domain. A successful Clerk dashboard verification is not sufficient; the browser must complete sign-in without `client_id`, `redirect_uri_mismatch`, or development-mode errors.
- **Owner authorization acceptance:** after signing in as the platform owner, verify the **Back Office** link appears in the operator sidebar and that Billing Support, Plans, Organizations, Audit Log, and other owner-only routes enforce the intended authorization.
- **Non-owner acceptance:** verify a normal customer/organization user does not gain platform-owner Back Office access.
- **Production presentation:** remove or suppress development/demo-only labels and notices before live release unless the product is intentionally running a demo environment.
- Record the production Clerk instance, verified domains, owner-access verification, Google sign-in result, and release commit in the release/change report. Do not record secret values.

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
