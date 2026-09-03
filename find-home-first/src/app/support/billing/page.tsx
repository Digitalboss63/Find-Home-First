import type { Metadata } from "next";
import Link from "next/link";
import {
  getSupportBillingOrganization,
  listStripeCharges,
  listSupportBillingOrganizations,
} from "@/lib/billing-support";
import { formatUsdFromCents } from "@/lib/refund-utils";
import { requireBillingSupport } from "@/lib/support-auth";

export const metadata: Metadata = { title: "Billing Support — Find Home First" };
export const dynamic = "force-dynamic";

interface SupportBillingPageProps {
  searchParams: Promise<{ org?: string; result?: string }>;
}

function resultNotice(result: string | undefined): string | null {
  switch (result) {
    case "refund-ok":
      return "Refund submitted successfully.";
    case "refund-and-cancel-ok":
      return "Refund submitted and subscription canceled.";
    case "refund-ok-no-subscription":
      return "Refund submitted. There was no active Stripe subscription to cancel.";
    case "refund-ok-cancel-failed":
      return "Refund submitted, but subscription cancellation failed. Review the customer before retrying cancellation.";
    case "invalid-amount":
      return "Refund amount is invalid or exceeds the remaining refundable amount.";
    case "no-stripe-customer":
      return "This organization does not have a Stripe customer yet.";
    case "charge-mismatch":
      return "Refund blocked because the charge does not belong to this customer.";
    case "refund-failed":
      return "Stripe could not complete the refund. No successful refund was recorded by this action.";
    case "invalid-request":
      return "Refund request was incomplete or not confirmed.";
    default:
      return null;
  }
}

function planLabel(plan: string | null): string {
  if (plan === "tier_1") return "Tier 1";
  if (plan === "tier_2") return "Tier 2";
  return "No plan";
}

export default async function SupportBillingPage({ searchParams }: SupportBillingPageProps) {
  const actor = await requireBillingSupport();
  const params = await searchParams;
  const organizations = await listSupportBillingOrganizations();
  const selectedId = params.org?.trim() ?? "";
  const selected = selectedId
    ? await getSupportBillingOrganization(selectedId)
    : null;

  let charges: Awaited<ReturnType<typeof listStripeCharges>> = [];
  let chargeLoadError = false;
  if (selected?.stripeCustomerId) {
    try {
      charges = await listStripeCharges(selected.stripeCustomerId, 10);
    } catch {
      chargeLoadError = true;
    }
  }

  const notice = resultNotice(params.result);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-secondary)" }}>
              Authorized Support Only
            </p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
              Billing Support
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.65 }}>
              Refund customer payments and optionally cancel the related subscription.
            </p>
          </div>
          <div className="text-sm sm:text-right" style={{ color: "var(--color-text)", opacity: 0.65 }}>
            <p>{actor.name || actor.email || "Authorized support"}</p>
            {actor.isPlatformOwner && (
              <Link href="/back-office" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
                Back Office
              </Link>
            )}
          </div>
        </div>

        {notice && (
          <div
            className="rounded-lg px-4 py-3 mb-6 text-sm"
            style={{ backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            role="status"
          >
            {notice}
          </div>
        )}

        <section className="rounded-xl p-5 mb-6" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
          <h2 className="font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
            1. Choose customer organization
          </h2>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Organization
              <select
                name="org"
                defaultValue={selected?.organizationId ?? ""}
                className="mt-1 block w-full rounded-lg px-3 py-2.5 text-sm"
                style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff" }}
              >
                <option value="">Select an organization</option>
                {organizations.map((organization) => (
                  <option key={organization.organizationId} value={organization.organizationId}>
                    {organization.organizationName} — {planLabel(organization.plan)}{organization.stripeSubscriptionStatus ? ` · ${organization.stripeSubscriptionStatus}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
            >
              Load Billing
            </button>
          </form>
        </section>

        {selected && (
          <section className="mb-6">
            <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold" style={{ color: "var(--color-primary)" }}>{selected.organizationName}</h2>
                  <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.65 }}>
                    {planLabel(selected.plan)} · {selected.stripeSubscriptionStatus || "No subscription status"}
                  </p>
                </div>
                <div className="text-xs sm:text-right" style={{ color: "var(--color-text)", opacity: 0.55 }}>
                  <p>Customer: {selected.stripeCustomerId || "Not created"}</p>
                  <p>Subscription: {selected.stripeSubscriptionId || "None"}</p>
                </div>
              </div>
            </div>

            <h2 className="font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
              2. Select payment to refund
            </h2>

            {!selected.stripeCustomerId ? (
              <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
                This organization has no Stripe customer yet.
              </p>
            ) : chargeLoadError ? (
              <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
                Stripe charges could not be loaded right now.
              </p>
            ) : charges.length === 0 ? (
              <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
                No Stripe charges found for this customer.
              </p>
            ) : (
              <div className="space-y-4">
                {charges.map((charge) => {
                  const remainingCents = Math.max(0, charge.amount - charge.amountRefunded);
                  const refundable = charge.paid && remainingCents > 0;

                  return (
                    <article key={charge.id} className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                        <div>
                          <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
                            {formatUsdFromCents(charge.amount)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.6 }}>
                            {charge.createdAt.toLocaleString()} · {charge.status}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "var(--color-text)", opacity: 0.5 }}>
                            {charge.id}
                          </p>
                        </div>
                        <div className="text-sm sm:text-right" style={{ color: "var(--color-text)" }}>
                          <p>Refunded: {formatUsdFromCents(charge.amountRefunded)}</p>
                          <p className="font-semibold">Refundable: {formatUsdFromCents(remainingCents)}</p>
                          {charge.receiptUrl && (
                            <a href={charge.receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold hover:underline" style={{ color: "var(--color-secondary)" }}>
                              View Stripe receipt
                            </a>
                          )}
                        </div>
                      </div>

                      {refundable ? (
                        <form action="/api/support/billing/refund" method="post" className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <input type="hidden" name="organizationId" value={selected.organizationId} />
                          <input type="hidden" name="chargeId" value={charge.id} />

                          <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                            Refund amount
                            <input
                              name="amount"
                              inputMode="decimal"
                              placeholder={`Full refund (${formatUsdFromCents(remainingCents)})`}
                              className="mt-1 block w-full rounded-lg px-3 py-2.5 text-sm"
                              style={{ border: "1px solid var(--color-border)" }}
                            />
                            <span className="block mt-1 text-xs font-normal" style={{ opacity: 0.55 }}>
                              Leave blank for the full remaining amount.
                            </span>
                          </label>

                          <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                            Reason
                            <select
                              name="reason"
                              defaultValue="customer_request"
                              className="mt-1 block w-full rounded-lg px-3 py-2.5 text-sm"
                              style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff" }}
                            >
                              <option value="customer_request">Customer request</option>
                              <option value="service_issue">Service issue</option>
                              <option value="duplicate">Duplicate / incorrect charge</option>
                              <option value="fraudulent">Fraudulent charge</option>
                              <option value="other">Other</option>
                            </select>
                          </label>

                          <label className="text-sm font-medium md:col-span-2" style={{ color: "var(--color-text)" }}>
                            Support note
                            <input
                              name="reasonNote"
                              maxLength={500}
                              placeholder="Optional internal note"
                              className="mt-1 block w-full rounded-lg px-3 py-2.5 text-sm"
                              style={{ border: "1px solid var(--color-border)" }}
                            />
                          </label>

                          <div className="md:col-span-2 space-y-3 rounded-lg p-4" style={{ backgroundColor: "var(--color-surface-soft)" }}>
                            {selected.stripeSubscriptionId && (
                              <label className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                                <input type="checkbox" name="cancelSubscription" value="yes" className="mt-0.5" />
                                <span>Also cancel this customer&apos;s subscription immediately.</span>
                              </label>
                            )}
                            <label className="flex items-start gap-2 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                              <input type="checkbox" name="confirm" value="yes" required className="mt-0.5" />
                              <span>I confirm this refund should be sent to Stripe.</span>
                            </label>
                          </div>

                          <div className="md:col-span-2 flex justify-end">
                            <button
                              type="submit"
                              className="rounded-lg px-5 py-2.5 text-sm font-semibold"
                              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
                            >
                              Issue Refund
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
                          This charge has no remaining refundable amount.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <p className="text-xs mt-8" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          Refund and cancellation actions are recorded in the Find Home First audit log.
        </p>
      </div>
    </main>
  );
}
