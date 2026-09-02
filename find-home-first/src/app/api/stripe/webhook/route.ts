import { NextRequest, NextResponse } from "next/server";
import {
  getStripeObjectId,
  retrieveStripeSubscription,
  saveStripeSubscription,
  verifyStripeWebhookSignature,
  type StripeCheckoutSessionRecord,
  type StripeSubscriptionRecord,
} from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeEvent {
  id?: string;
  type?: string;
  data?: {
    object?: unknown;
  };
}

function organizationIdFromMetadata(
  metadata: Record<string, string> | null | undefined
): string | null {
  return metadata?.organization_id?.trim() || null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (
    !signature ||
    !verifyStripeWebhookSignature(payload, signature, webhookSecret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object as StripeCheckoutSessionRecord | undefined;
      if (session?.mode === "subscription") {
        const organizationId =
          organizationIdFromMetadata(session.metadata) ||
          session.client_reference_id?.trim() ||
          null;
        const subscriptionId = getStripeObjectId(session.subscription);

        if (organizationId && subscriptionId) {
          const subscription = await retrieveStripeSubscription(subscriptionId);
          await saveStripeSubscription(organizationId, subscription);
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data?.object as StripeSubscriptionRecord | undefined;
      if (subscription?.id) {
        const organizationId = organizationIdFromMetadata(subscription.metadata);
        if (organizationId) {
          await saveStripeSubscription(organizationId, subscription);
        }
      }
    }
  } catch (error) {
    console.error(
      "[stripe-webhook] Event processing failed",
      event.type,
      event.id,
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
