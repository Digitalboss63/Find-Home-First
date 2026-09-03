import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { isBillingPlan, saveOrganizationBilling } from "@/lib/billing";

export interface SupportBillingOrganization {
  organizationId: string;
  organizationName: string;
  plan: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
}

export interface StripeChargeView {
  id: string;
  amount: number;
  amountRefunded: number;
  currency: string;
  paid: boolean;
  refunded: boolean;
  status: string;
  createdAt: Date;
  customerId: string | null;
  description: string | null;
  receiptUrl: string | null;
}

interface StripeChargeRecord {
  id: string;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
  paid?: boolean;
  refunded?: boolean;
  status?: string;
  created?: number;
  customer?: string | { id?: string } | null;
  description?: string | null;
  receipt_url?: string | null;
}

interface StripeList<T> {
  data?: T[];
}

interface StripeRefundRecord {
  id: string;
  amount?: number;
  status?: string | null;
  charge?: string | { id?: string } | null;
}

interface StripeSubscriptionRecord {
  id: string;
  status?: string | null;
  customer?: string | { id?: string } | null;
}

interface StripeErrorResponse {
  error?: {
    message?: string;
  };
}

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe billing is not configured.");
  return key;
}

async function stripeSupportRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    params?: URLSearchParams;
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
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

function objectId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function mapOrganization(row: {
  organization_id: string;
  organization_name: string;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
}): SupportBillingOrganization {
  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    plan: row.plan,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeSubscriptionStatus: row.stripe_subscription_status,
  };
}

export async function listSupportBillingOrganizations(): Promise<SupportBillingOrganization[]> {
  const db = getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      ob.plan,
      ob.stripe_customer_id,
      ob.stripe_subscription_id,
      ob.stripe_subscription_status
    FROM organizations o
    LEFT JOIN organization_billing ob ON ob.organization_id = o.id
    ORDER BY o.name ASC
  `);

  return Array.from(
    result as Iterable<{
      organization_id: string;
      organization_name: string;
      plan: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
    }>
  ).map(mapOrganization);
}

export async function getSupportBillingOrganization(
  organizationId: string
): Promise<SupportBillingOrganization | null> {
  const db = getDb();
  if (!db) return null;

  const result = await db.execute(sql`
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      ob.plan,
      ob.stripe_customer_id,
      ob.stripe_subscription_id,
      ob.stripe_subscription_status
    FROM organizations o
    LEFT JOIN organization_billing ob ON ob.organization_id = o.id
    WHERE o.id = ${organizationId}::uuid
    LIMIT 1
  `);

  const row = Array.from(
    result as Iterable<{
      organization_id: string;
      organization_name: string;
      plan: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
    }>
  )[0];

  return row ? mapOrganization(row) : null;
}

export async function listStripeCharges(
  customerId: string,
  limit = 10
): Promise<StripeChargeView[]> {
  const query = new URLSearchParams();
  query.set("customer", customerId);
  query.set("limit", String(Math.max(1, Math.min(limit, 25))));

  const list = await stripeSupportRequest<StripeList<StripeChargeRecord>>(
    `/charges?${query.toString()}`
  );

  return (list.data ?? []).map((charge) => ({
    id: charge.id,
    amount: charge.amount ?? 0,
    amountRefunded: charge.amount_refunded ?? 0,
    currency: charge.currency ?? "usd",
    paid: charge.paid === true,
    refunded: charge.refunded === true,
    status: charge.status ?? "unknown",
    createdAt: new Date((charge.created ?? 0) * 1000),
    customerId: objectId(charge.customer),
    description: charge.description ?? null,
    receiptUrl: charge.receipt_url ?? null,
  }));
}

export async function retrieveStripeCharge(chargeId: string): Promise<StripeChargeView> {
  const charge = await stripeSupportRequest<StripeChargeRecord>(
    `/charges/${encodeURIComponent(chargeId)}`
  );

  return {
    id: charge.id,
    amount: charge.amount ?? 0,
    amountRefunded: charge.amount_refunded ?? 0,
    currency: charge.currency ?? "usd",
    paid: charge.paid === true,
    refunded: charge.refunded === true,
    status: charge.status ?? "unknown",
    createdAt: new Date((charge.created ?? 0) * 1000),
    customerId: objectId(charge.customer),
    description: charge.description ?? null,
    receiptUrl: charge.receipt_url ?? null,
  };
}

export async function createStripeChargeRefund(input: {
  chargeId: string;
  amountCents: number;
  standardReason: "duplicate" | "fraudulent" | "requested_by_customer";
}): Promise<{ refundId: string; amountCents: number; status: string | null }> {
  const params = new URLSearchParams();
  params.set("charge", input.chargeId);
  params.set("amount", String(input.amountCents));
  params.set("reason", input.standardReason);

  const refund = await stripeSupportRequest<StripeRefundRecord>("/refunds", {
    method: "POST",
    params,
  });

  return {
    refundId: refund.id,
    amountCents: refund.amount ?? input.amountCents,
    status: refund.status ?? null,
  };
}

export async function cancelSupportOrganizationSubscription(
  organization: SupportBillingOrganization
): Promise<string> {
  if (!organization.stripeSubscriptionId) {
    throw new Error("Organization does not have a Stripe subscription.");
  }

  const subscription = await stripeSupportRequest<StripeSubscriptionRecord>(
    `/subscriptions/${encodeURIComponent(organization.stripeSubscriptionId)}`,
    { method: "DELETE" }
  );

  const status = subscription.status ?? "canceled";
  await saveOrganizationBilling({
    organizationId: organization.organizationId,
    plan: isBillingPlan(organization.plan) ? organization.plan : null,
    stripeCustomerId: organization.stripeCustomerId,
    stripeSubscriptionId: organization.stripeSubscriptionId,
    stripeSubscriptionStatus: status,
  });

  return status;
}
