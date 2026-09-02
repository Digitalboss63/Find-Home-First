CREATE TABLE IF NOT EXISTS "organization_billing" (
  "organization_id" uuid PRIMARY KEY NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "plan" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_subscription_status" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_billing_customer_idx" ON "organization_billing" ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_billing_subscription_idx" ON "organization_billing" ("stripe_subscription_id") WHERE "stripe_subscription_id" IS NOT NULL;
