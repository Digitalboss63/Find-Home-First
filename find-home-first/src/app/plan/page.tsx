/**
 * /plan — Plan & Billing
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - Tier 1: $49.99/month — Owner only, no staff, no Admin Console
 * - Tier 2: $79/month launch price — Owner + unlimited staff + Admin Console
 * - CTA buttons disabled until Stripe is configured
 * - No fake purchase flow
 */
import type { Metadata } from "next";
import { DEMO_PLANS } from "@/demo/data";

export const metadata: Metadata = {
  title: "Plan & Billing",
  description: "Find Home First plans and pricing.",
};

export default function PlanPage() {
  return (
    <div>
      <h1>Plan &amp; Billing</h1>
      <p>Stripe billing is a future phase. Plan selection is illustrative only.</p>

      <ul>
        {DEMO_PLANS.map((plan) => (
          <li key={plan.id}>
            <article aria-labelledby={`plan-${plan.id}-heading`}>
              <h2 id={`plan-${plan.id}-heading`}>
                {plan.name} — {plan.price} {plan.period}
                {plan.recommended && " (recommended)"}
              </h2>
              <p>{plan.description}</p>

              <h3>Included</h3>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {plan.limitations.length > 0 && (
                <>
                  <h3>Not included</h3>
                  <ul>
                    {plan.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </>
              )}


            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
