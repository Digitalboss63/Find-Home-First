import { NextRequest, NextResponse } from "next/server";
import {
  cancelSupportOrganizationSubscription,
  createStripeChargeRefund,
  getSupportBillingOrganization,
  retrieveStripeCharge,
} from "@/lib/billing-support";
import { writeAuditLog } from "@/lib/repository";
import { parseRefundAmountToCents } from "@/lib/refund-utils";
import { requireBillingSupport } from "@/lib/support-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTION_ORIGIN = "https://www.findhomefirst.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Use the canonical production origin below.
    }
  }

  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  return request.nextUrl.origin;
}

function supportUrl(
  request: NextRequest,
  organizationId: string | null,
  result: string
): URL {
  const url = new URL("/support/billing", publicOrigin(request));
  if (organizationId) url.searchParams.set("org", organizationId);
  url.searchParams.set("result", result);
  return url;
}

function standardStripeReason(value: string): "duplicate" | "fraudulent" | "requested_by_customer" {
  if (value === "duplicate") return "duplicate";
  if (value === "fraudulent") return "fraudulent";
  return "requested_by_customer";
}

function safeErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

export async function POST(request: NextRequest) {
  const actor = await requireBillingSupport();
  const formData = await request.formData();

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const chargeId = String(formData.get("chargeId") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").trim();
  const reasonCode = String(formData.get("reason") ?? "customer_request").trim();
  const reasonNote = String(formData.get("reasonNote") ?? "").trim().slice(0, 500);
  const cancelSubscription = formData.get("cancelSubscription") === "yes";
  const confirmed = formData.get("confirm") === "yes";

  if (!UUID_RE.test(organizationId) || !chargeId.startsWith("ch_") || !confirmed) {
    return NextResponse.redirect(
      supportUrl(request, UUID_RE.test(organizationId) ? organizationId : null, "invalid-request"),
      303
    );
  }

  const organization = await getSupportBillingOrganization(organizationId);
  if (!organization?.stripeCustomerId) {
    return NextResponse.redirect(supportUrl(request, organizationId, "no-stripe-customer"), 303);
  }

  try {
    const charge = await retrieveStripeCharge(chargeId);
    if (charge.customerId !== organization.stripeCustomerId) {
      await writeAuditLog({
        actorClerkUserId: actor.clerkUserId,
        actorEmail: actor.email,
        eventType: "billing.refund.blocked",
        organizationId,
        detail: JSON.stringify({ reason: "charge_customer_mismatch", chargeId }),
      });
      return NextResponse.redirect(supportUrl(request, organizationId, "charge-mismatch"), 303);
    }

    const remainingCents = charge.amount - charge.amountRefunded;
    const amountCents = parseRefundAmountToCents(amount, remainingCents);
    if (amountCents == null) {
      return NextResponse.redirect(supportUrl(request, organizationId, "invalid-amount"), 303);
    }

    const refund = await createStripeChargeRefund({
      chargeId,
      amountCents,
      standardReason: standardStripeReason(reasonCode),
    });

    await writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorEmail: actor.email,
      eventType: "billing.refund.created",
      organizationId,
      detail: JSON.stringify({
        refundId: refund.refundId,
        chargeId,
        amountCents: refund.amountCents,
        stripeStatus: refund.status,
        supportReason: reasonCode,
        reasonNote: reasonNote || null,
        cancelSubscriptionRequested: cancelSubscription,
      }),
    });

    if (!cancelSubscription) {
      return NextResponse.redirect(supportUrl(request, organizationId, "refund-ok"), 303);
    }

    if (!organization.stripeSubscriptionId) {
      return NextResponse.redirect(supportUrl(request, organizationId, "refund-ok-no-subscription"), 303);
    }

    try {
      const subscriptionStatus = await cancelSupportOrganizationSubscription(organization);
      await writeAuditLog({
        actorClerkUserId: actor.clerkUserId,
        actorEmail: actor.email,
        eventType: "billing.subscription.canceled_by_support",
        organizationId,
        detail: JSON.stringify({
          stripeSubscriptionId: organization.stripeSubscriptionId,
          subscriptionStatus,
          relatedRefundId: refund.refundId,
        }),
      });
      return NextResponse.redirect(supportUrl(request, organizationId, "refund-and-cancel-ok"), 303);
    } catch (cancelError) {
      await writeAuditLog({
        actorClerkUserId: actor.clerkUserId,
        actorEmail: actor.email,
        eventType: "billing.subscription.cancel_failed",
        organizationId,
        detail: JSON.stringify({
          stripeSubscriptionId: organization.stripeSubscriptionId,
          relatedRefundId: refund.refundId,
          error: safeErrorMessage(cancelError),
        }),
      });
      return NextResponse.redirect(supportUrl(request, organizationId, "refund-ok-cancel-failed"), 303);
    }
  } catch (error) {
    await writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorEmail: actor.email,
      eventType: "billing.refund.failed",
      organizationId,
      detail: JSON.stringify({
        chargeId,
        error: safeErrorMessage(error),
      }),
    });
    return NextResponse.redirect(supportUrl(request, organizationId, "refund-failed"), 303);
  }
}
