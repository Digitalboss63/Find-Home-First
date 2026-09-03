import { NextRequest, NextResponse } from "next/server";
import { requireOrganization, requireRole } from "@/lib/auth";
import {
  createStripeBillingPortalSession,
  getOrganizationBilling,
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

function planUrl(request: NextRequest, billing: string): URL {
  const url = new URL("/plan", publicOrigin(request));
  url.searchParams.set("billing", billing);
  return url;
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrganization({ allowInactiveBilling: true });
  await requireRole(ctx, "owner");

  const billing = await getOrganizationBilling(ctx.organizationId);
  if (!billing.stripeCustomerId) {
    return NextResponse.redirect(planUrl(request, "portal-unavailable"), 303);
  }

  try {
    const session = await createStripeBillingPortalSession({
      stripeCustomerId: billing.stripeCustomerId,
      origin: publicOrigin(request),
    });

    if (!session.url) {
      throw new Error("Stripe did not return a billing portal URL.");
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error(
      "[billing-portal] Stripe billing portal failed",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.redirect(planUrl(request, "portal-error"), 303);
  }
}
