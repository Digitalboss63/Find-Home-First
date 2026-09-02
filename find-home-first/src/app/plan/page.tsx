import type { Metadata } from "next";
import { DEMO_PLANS } from "@/demo/data";
import { requireOrganization } from "@/lib/auth";
import {
  getOrganizationBilling,
  hasBillingAccess,
  type BillingPlan,
} from "@/lib/billing";

export const metadata: Metadata = {
  title: "Plan & Billing",
  description: "Find Home First plans and pricing.",
};

interface PlanPageProps {
  searchParams: Promise<{ billing?: string }>;
}

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

function planKey(planId: string): BillingPlan {
  return planId === "tier-2" ? "tier_2" : "tier_1";
}

function planLabel(plan: BillingPlan | null): string {
  if (plan === "tier_1") return "Tier 1";
  if (plan === "tier_2") return "Tier 2";
  return "Subscription";
}

function billingNotice(code: string | undefined): string | null {
  if (code === "required") return "Choose a plan to activate Find Home First for your organization.";
  if (code === "success") return "Checkout completed. Stripe is confirming your subscription; your plan will activate automatically.";
  if (code === "canceled") return "Checkout was canceled. No subscription was created.";
  if (code === "already-active") return "Your organization already has an active subscription.";
  if (code === "error") return "Stripe Checkout could not be started. Please try again or contact support.";
  return null;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const ctx = await requireOrganization({ allowInactiveBilling: true });
  const [params, billing] = await Promise.all([
    searchParams,
    getOrganizationBilling(ctx.organizationId),
  ]);

  const active =
    !!billing.plan && hasBillingAccess(billing.stripeSubscriptionStatus);
  const notice = billingNotice(params.billing);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
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

      {(notice || active) && (
        <div
          className="rounded-lg px-4 py-3.5 text-sm mb-8"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
          role="status"
        >
          {active ? (
            <p>
              Billing active — <strong>{planLabel(billing.plan)}</strong>
              {billing.stripeSubscriptionStatus
                ? ` · ${billing.stripeSubscriptionStatus}`
                : ""}
            </p>
          ) : (
            <p>{notice}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DEMO_PLANS.map((plan) => {
          const stripePlan = planKey(plan.id);
          const isCurrent = active && billing.plan === stripePlan;

          return (
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

                <h3 className="sr-only">Included features</h3>
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span
                        className="text-sm"
                        style={{
                          color: plan.recommended ? "#fff" : "var(--color-text)",
                          opacity: plan.recommended ? 0.9 : 0.8,
                        }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}

                  {plan.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2.5">
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
                        {limitation}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="px-6 py-4 border-t"
                style={{
                  borderColor: plan.recommended
                    ? "rgba(255,255,255,0.15)"
                    : "var(--color-border)",
                }}
              >
                {isCurrent ? (
                  <div
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-center"
                    style={{
                      backgroundColor: plan.recommended
                        ? "rgba(255,255,255,0.15)"
                        : "var(--color-surface-soft)",
                      color: plan.recommended ? "#fff" : "var(--color-primary)",
                    }}
                  >
                    Current Plan
                  </div>
                ) : active ? (
                  <div
                    className="text-xs text-center"
                    style={{
                      color: plan.recommended
                        ? "rgba(255,255,255,0.65)"
                        : "var(--color-text)",
                      opacity: plan.recommended ? undefined : 0.6,
                    }}
                  >
                    Contact support to change an active subscription.
                  </div>
                ) : ctx.role === "owner" ? (
                  <form action="/api/billing/checkout" method="post">
                    <input type="hidden" name="plan" value={stripePlan} />
                    <button
                      type="submit"
                      className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: plan.recommended
                          ? "var(--color-secondary)"
                          : "var(--color-primary)",
                        color: "#fff",
                      }}
                    >
                      Choose {plan.name}
                    </button>
                  </form>
                ) : (
                  <div
                    className="text-xs text-center"
                    style={{
                      color: plan.recommended
                        ? "rgba(255,255,255,0.65)"
                        : "var(--color-text)",
                      opacity: plan.recommended ? undefined : 0.6,
                    }}
                  >
                    Your organization owner manages billing.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
