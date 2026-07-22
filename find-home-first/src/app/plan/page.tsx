/**
 * /plan — Plan & Billing
 *
 * Presents two pricing tiers side by side (desktop) or stacked (mobile).
 * No purchase flow in Phase 1 — Stripe is a future phase.
 * No CTA buttons rendered until billing is wired.
 */
import type { Metadata } from "next";
import { DEMO_PLANS } from "@/demo/data";

export const metadata: Metadata = {
  title: "Plan & Billing",
  description: "Find Home First plans and pricing.",
};

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--color-secondary)" }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ color: "var(--color-border)" }}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

export default function PlanPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          Plan &amp; Billing
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          Choose the plan that fits your organization.
        </p>
      </div>

      {/* Honest notice — Stripe not yet configured */}
      <div
        className="flex gap-3 rounded-lg px-4 py-3.5 text-sm mb-8"
        style={{
          backgroundColor: "var(--color-surface-soft)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <span aria-hidden="true" style={{ color: "var(--color-secondary)", opacity: 0.8 }}>ℹ</span>
        <p>
          Billing is not yet active. These plans are provided for reference only.
          Purchase options will be available when Stripe is configured.
        </p>
      </div>

      {/* ── Plan cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DEMO_PLANS.map((plan) => (
          <article
            key={plan.id}
            aria-labelledby={`plan-${plan.id}-heading`}
            className="rounded-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: plan.recommended ? "var(--color-primary)" : "#fff",
              border: plan.recommended
                ? "2px solid var(--color-secondary)"
                : "1px solid var(--color-border)",
            }}
          >
            {/* Recommended banner */}
            {plan.recommended && (
              <div
                className="px-5 py-2 text-xs font-semibold tracking-widest uppercase text-center"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  color: "#fff",
                }}
              >
                Recommended
              </div>
            )}

            <div className="flex-1 px-6 py-6">
              {/* Plan name + price */}
              <h2
                id={`plan-${plan.id}-heading`}
                className="text-lg font-bold mb-1"
                style={{ color: plan.recommended ? "#fff" : "var(--color-primary)" }}
              >
                {plan.name}
              </h2>

              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className="text-3xl font-bold"
                  style={{ color: plan.recommended ? "#fff" : "var(--color-primary)" }}
                >
                  {plan.price}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: plan.recommended
                      ? "rgba(255,255,255,0.7)"
                      : "var(--color-text)",
                    opacity: plan.recommended ? undefined : 0.55,
                  }}
                >
                  {plan.period}
                </span>
              </div>

              <p
                className="text-sm mb-5 leading-relaxed"
                style={{
                  color: plan.recommended
                    ? "rgba(255,255,255,0.75)"
                    : "var(--color-text)",
                  opacity: plan.recommended ? undefined : 0.7,
                }}
              >
                {plan.description}
              </p>

              {/* Features included */}
              <h3 className="sr-only">Included features</h3>
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span
                      className="text-sm"
                      style={{
                        color: plan.recommended ? "#fff" : "var(--color-text)",
                        opacity: plan.recommended ? 0.9 : 0.8,
                      }}
                    >
                      {f}
                    </span>
                  </li>
                ))}

                {/* Limitations */}
                {plan.limitations.map((l) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <MinusIcon />
                    <span
                      className="text-sm"
                      style={{
                        color: plan.recommended
                          ? "rgba(255,255,255,0.45)"
                          : "var(--color-text)",
                        opacity: plan.recommended ? undefined : 0.45,
                      }}
                    >
                      {l}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer note (no CTA — Stripe not configured) */}
            <div
              className="px-6 py-4 border-t text-xs"
              style={{
                borderColor: plan.recommended
                  ? "rgba(255,255,255,0.15)"
                  : "var(--color-border)",
                color: plan.recommended
                  ? "rgba(255,255,255,0.4)"
                  : "var(--color-text)",
                opacity: plan.recommended ? undefined : 0.45,
              }}
            >
              Purchase available when billing is configured.
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
