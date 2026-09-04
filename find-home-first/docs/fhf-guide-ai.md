# FHF Guide — Natural-Language AI Layer

## Purpose

FHF Guide uses a hybrid architecture:

1. The Find Home First workflow engine remains authoritative for project stage, blockers, missing requirements, and next actions.
2. The Help Center knowledge repository remains authoritative for feature instructions.
3. An optional language-model layer turns normal user questions into concise guidance using only privacy-minimized workflow context and relevant help excerpts.
4. If the external AI provider is unavailable or not configured, FHF Guide falls back to deterministic workflow guidance instead of failing.

## Production configuration

Set this Railway environment variable to enable natural-language AI answers:

- `OPENAI_API_KEY` — server-side API key. Never expose this as a `NEXT_PUBLIC_*` variable.

Optional:

- `FHF_GUIDE_MODEL` — model ID used by the guide. Default: `gpt-5.6-luna`.

No database migration is required.

## Privacy boundary

The external model is not sent:

- resident names
- project names
- community/location names from the project record
- property addresses
- landlord/contact information
- task titles or descriptions
- uploaded documents
- internal project IDs

The external model receives only a minimized operational snapshot such as:

- current workflow status
- current stage label
- whether a blocker exists
- generic missing-item labels
- deterministic next-action label/reason
- saved-property count
- open-task count
- generic Help Center excerpts

The user's typed question is sent when they press **Ask**, so the UI tells users not to enter resident names or other personal details.

## Safety and reliability

The model is instructed not to invent housing-program rules, payment amounts, eligibility decisions, legal requirements, guarantees, or project facts. The deterministic Find Home First next action and missing-item logic always remain authoritative.

The Responses API request uses `store: false`. Provider failures, timeouts, missing credentials, and empty model responses return deterministic FHF workflow guidance.
