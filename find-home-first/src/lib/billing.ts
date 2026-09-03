import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export const BILLING_PLANS = ["tier_1", "tier_2"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

const DEFAULT_PRICE_IDS: Record<BillingPlan, string> = {
  tier_1: "price_1UBLplQKeLMHHhMroAJrTxT2",
  tier_2: "price_1UBLslQKeLMHHhMrEFJfgDmc",
};

const ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface OrganizationBilling {
  organizationId: string;
  plan: BillingPlan | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  updatedAt: Date | null;
}

export interface StripeSubscriptionRecord {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: { id?: string | null } | null;
    }>;
  } | null;
}

interface StripeCheckoutSessionRecord {
  id: string;
  url?: string | null;
  mode?: string | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}

interface StripeBillingPortalSessionRecord {
  id: string;
  url?: string | null;
}

interface StripeErrorResponse {
  error?: {
    message?: string;
  };
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === "string" && BILLING_PLANS.includes(value as BillingPlan);
}

export function hasBillingAccess(status: string | null | undefined): boolean {
  return !!status && ACCESS_STATUSES.has(status);
}

export function getStripePriceId(plan: BillingPlan): string {
  const override =
    plan === "tier_1"
      ? process.env.STRIPE_TIER1_PRICE_ID
      : process.env.STRIPE_TIER2_PRICE_ID;
  return override?.trim() || DEFAULT_PRICE_IDS[plan];
}

export function planFromPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === getStripePriceId("tier_1")) return "tier_1";
  if (priceId === getStripePriceId("tier_2")) return "tier_2";
  return null;
}

function getRequiredStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe billing is not configured.");
  return key;
}

async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; params?: URLSearchParams } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getRequiredStripeSecretKey()}`,
      ...(options.params
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: options.params?.toString(),
    cache: "no-store",
  });

  const body = (await response.json()) as T & StripeErrorResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || `Stripe request failed (${response.status}).`);
  }
  return body;
}

export async function createStripeCheckoutSession(input: {
  plan: BillingPlan;
  organizationId: string;
  customerEmail: string | null;
  stripeCustomerId: string | null;
  origin: string;
}): Promise<StripeCheckoutSessionRecord> {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", getStripePriceId(input.plan));
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${input.origin}/plan?billing=success`);
  params.set("cancel_url", `${input.origin}/plan?billing=canceled`);
  params.set("client_reference_id", input.organizationId);
  params.set("metadata[organization_id]", input.organizationId);
  params.set("metadata[plan]", input.plan);
  params.set("subscription_data[metadata][organization_id]", input.organizationId);
  params.set("subscription_data[metadata][plan]", input.plan);

  if (input.stripeCustomerId) {
    params.set("customer", input.stripeCustomerId);
  } else if (input.customerEmail) {
    params.set("customer_email", input.customerEmail);
  }

  return stripeRequest<StripeCheckoutSessionRecord>("/checkout/sessions", {
    method: "POST",
    params,
  });
}

export async function createStripeBillingPortalSession(input: {
  stripeCustomerId: string;
  origin: string;
}): Promise<StripeBillingPortalSessionRecord> {
  const params = new URLSearchParams();
  params.set("customer", input.stripeCustomerId);
  params.set("return_url", `${input.origin}/plan`);

  return stripeRequest<StripeBillingPortalSessionRecord>(
    "/billing_portal/sessions",
    {
      method: "POST",
      params,
    }
  );
}

export async function retrieveStripeSubscription(
  subscriptionId: string
): Promise<StripeSubscriptionRecord> {
  return stripeRequest<StripeSubscriptionRecord>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

export function getStripeObjectId(
  value: string | { id?: string } | null | undefined
): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function getPlanFromSubscription(
  subscription: StripeSubscriptionRecord
): BillingPlan | null {
  const metadataPlan = subscription.metadata?.plan;
  if (isBillingPlan(metadataPlan)) return metadataPlan;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return planFromPriceId(priceId);
}

export async function getOrganizationBilling(
  organizationId: string
): Promise<OrganizationBilling> {
  const db = getDb();
  if (!db) {
    return {
      organizationId,
      plan: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      updatedAt: null,
    };
  }

  const result = await db.execute(sql`
    SELECT
      organization_id,
      plan,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_status,
      updated_at
    FROM organization_billing
    WHERE organization_id = ${organizationId}::uuid
    LIMIT 1
  `);

  const row = Array.from(
    result as Iterable<{
      organization_id: string;
      plan: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
      updated_at: Date | string | null;
    }>
  )[0];

  if (!row) {
    return {
      organizationId,
      plan: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      updatedAt: null,
    };
  }

  return {
    organizationId: row.organization_id,
    plan: isBillingPlan(row.plan) ? row.plan : null,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeSubscriptionStatus: row.stripe_subscription_status,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at
        : row.updated_at
          ? new Date(row.updated_at)
          : null,
  };
}

export async function saveOrganizationBilling(input: {
  organizationId: string;
  plan: BillingPlan | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
}): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database unavailable while updating billing.");

  await db.execute(sql`
    INSERT INTO organization_billing (
      organization_id,
      plan,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_status,
      updated_at
    ) VALUES (
      ${input.organizationId}::uuid,
      ${input.plan},
      ${input.stripeCustomerId},
      ${input.stripeSubscriptionId},
      ${input.stripeSubscriptionStatus},
      now()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_subscription_status = EXCLUDED.stripe_subscription_status,
      updated_at = now()
  `);
}

export async function saveStripeSubscription(
  organizationId: string,
  subscription: StripeSubscriptionRecord
): Promise<void> {
  await saveOrganizationBilling({
    organizationId,
    plan: getPlanFromSubscription(subscription),
    stripeCustomerId: getStripeObjectId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status ?? null,
  });
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300
): boolean {
  const pieces = signatureHeader.split(",").map((piece) => piece.trim());
  const timestampValue = pieces
    .find((piece) => piece.startsWith("t="))
    ?.slice(2);
  const signatures = pieces
    .filter((piece) => piece.startsWith("v1="))
    .map((piece) => piece.slice(3));

  if (!timestampValue || signatures.length === 0) return false;
  const timestamp = Number(timestampValue);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestampValue}.${payload}`, "utf8")
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return (
      candidate.length === expectedBuffer.length &&
      timingSafeEqual(candidate, expectedBuffer)
    );
  });
}

export type { StripeCheckoutSessionRecord };
