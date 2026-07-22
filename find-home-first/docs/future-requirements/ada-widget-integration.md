# Future Requirement — ADA Widget Integration

**Status:** Not implemented. Do not build until prerequisites are in place.

## Intent

Allow the organization owner to enable and configure a third-party ADA
accessibility widget (e.g. UserWay, accessiBe, Equal Web) directly within
the platform, without modifying code or environment variables.

## Location

Back Office → Site Settings → Integrations

## Behavior

- An **Enable Widget** toggle controls whether any widget code loads globally.
- An **Embed Code** textarea accepts the full `<script>` tag provided by the
  chosen vendor.
- When enabled and saved, the stored embed code loads on every page of the
  platform (injected once, guarded against duplicate loading).
- When disabled or empty, nothing loads.
- The widget attaches its own UI to the document; the platform provides no
  custom widget implementation.

## Access Control

- Only the **Organization Owner** role may view or modify this setting.
- Staff users have no access to Site Settings → Integrations.

## Storage

- The embed code and enabled flag are stored in the platform database
  (PostgreSQL), not in environment variables or source code.
- The stored value must be treated as trusted owner input and rendered
  appropriately (no public-facing display of raw code).

## Prerequisites (all must exist before implementation)

1. Authentication system — Clerk or equivalent, with role enforcement
2. Owner-only back office and role-based route guards
3. PostgreSQL database with a platform settings table or equivalent
4. Secured admin API endpoint for reading/writing settings
5. Server-side embed code injection (layout or middleware) with duplicate-load guard

## Notes

- Do not implement a custom accessibility widget.
- Do not store the embed code in `.env` files or `next.config.ts`.
- Do not expose this setting to non-owner users under any circumstance.
- This requirement is intentionally deferred to avoid premature complexity
  before the secured back office exists.
