import { NextRequest, NextResponse } from "next/server";
import { requireOrganization, requireRole } from "@/lib/auth";
import {
  createStripeCheckoutSession,
  getOrganizationBilling,
  hasBillingAccess,
  isBillingPlan,
} from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTION_ORIGIN = "https://www.findhomefirst.com";

function publicOrigin(request: NextRequest): string {
  const configuredOrigin = process.env.APP_URL?.trim();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Fall through to the canonical production origin or request origin.
    }
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_ORIGIN;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function planUrl(
  request: NextRequest,
  billing: string,
  reason?: string
): URL {
  const url = new URL("/plan", publicOrigin(request));
  url.searchParams.set("billing", billing);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

function checkoutErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/not configured/i.test(message)) return "stripe-not-configured";
  if (/invalid api key|no api key|authentication/i.test(message)) return "stripe-auth";
  if (/restricted key|permission|not permitted/i.test(message)) return "stripe-permissions";
  if (/no such price|price.*does not exist/i.test(message)) return "stripe-price";
  if (/no such customer|customer.*does not exist/i.test(message)) return "stripe-customer";
  if (/account.*(disabled|not activated)|charges.*disabled/i.test(message)) return "stripe-account";
  if (/checkout url/i.test(message)) return "stripe-no-url";

  return "stripe-request";
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrganization({ allowInactiveBilling: true });
  await requireRole(ctx, "owner");

  const formData = await request.formData();
  const plan = formData.get("plan");
  if (!isBillingPlan(plan)) {
    return NextResponse.redirect(planUrl(request, "error", "invalid-plan"), 303);
  }

  const billing = await getOrganizationBilling(ctx.organizationId);
  if (hasBillingAccess(billing.stripeSubscriptionStatus)) {
    return NextResponse.redirect(planUrl(request, "already-active"), 303);
  }

  try {
    const session = await createStripeCheckoutSession({
      plan,
      organizationId: ctx.organizationId,
      customerEmail: ctx.user.email,
      stripeCustomerId: billing.stripeCustomerId,
      origin: publicOrigin(request),
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const reason = checkoutErrorReason(error);
    console.error(
      "[billing-checkout] Stripe Checkout failed",
      reason,
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.redirect(planUrl(request, "error", reason), 303);
  }
}
