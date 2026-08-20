<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Find Home First engineering protocol

## Protect the working tree

- Start every change with `git status --short --branch` and a targeted `git diff`.
- Treat unrelated local changes as user-owned. Do not overwrite, discard, or mix them into a feature commit.
- Keep commits focused enough that the changed behavior can be reviewed and rolled back independently.

## Evidence and fallback rules

- Prefer current primary government or provider data over copied summaries.
- Use this hierarchy for geographic evidence: exact municipality or program area, then county/metro, then a clearly labelled regional or statewide estimate, then unavailable.
- Never present a derived estimate as an exact local fact. Mark it in the web report, PDF, Excel, source record, and scoring confidence.
- Do not substitute one metric for another: HUD FMR is a rent benchmark, not a guaranteed program payment standard; listing rent is not FMR; a program rule still requires confirmation from that program.
- Preserve usable collected data when one source fails. Give the user a concrete retry action instead of instructing them to manually collect public data the application can retrieve.

## Required verification before release

- Use repository-local executables (`./node_modules/.bin/...`) when available so validation does not depend on an `npx` download or prompt.
- Required gates for application changes: TypeScript, lint, full tests, `git diff --check`, and a production Next.js build.
- Run `db:check` for schema or migration work. Test additive migrations in an isolated schema before production and verify the live schema after deployment.
- A successful homepage health check is not feature verification. Exercise the changed route, action, export, or data result after deployment.
- Never call a paid external API merely to prove code that can be tested with deterministic mocks. When a live call is necessary, state the expected call count first and record only safe metadata.

## Secrets and reporting

- Read credentials only from server-side environment variables. Never print, partially reveal, return, persist, or place them in public URLs.
- Release reports must distinguish what was tested locally, what was verified live, and what remains unverified. Do not call a feature production-ready based only on code inspection.
- Report durable evidence: commit/PR, deployment result, migration result when applicable, exact verification gates, and feature-specific live proof. Avoid long activity logs that do not help reproduce or audit the release.
