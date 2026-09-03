# Stripe Billing Production Activation

Find Home First uses Stripe Checkout for recurring subscriptions and a signed Stripe webhook for organization billing state.

## Live plans

- Tier 1: $49/month
- Tier 2: $79/month

The production Stripe price IDs are defined in `src/lib/billing.ts` and may be overridden with environment variables.

## Required Railway variables

Set these as server-side production variables in Railway:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional price overrides:

- `STRIPE_TIER1_PRICE_ID`
- `STRIPE_TIER2_PRICE_ID`

Never commit live Stripe secrets to GitHub.

## Live webhook

Stripe endpoint:

`https://www.findhomefirst.com/api/stripe/webhook`

Expected events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Customer Portal

The Plan & Billing screen contains a **Manage Billing** action for organization owners with a Stripe customer record.

Stripe Customer Portal must have an active live-mode configuration before portal sessions will open successfully. Configure the portal in Stripe to allow the billing actions Find Home First intends to support, including payment-method updates and cancellation. Plan switching should only be enabled if Tier 1/Tier 2 upgrade and downgrade behavior has been reviewed.

## Production acceptance

Do not mark Stripe billing production-ready until all of these are verified:

1. Railway has the live Stripe secret key and matching webhook signing secret.
2. The billing migration is present in production.
3. An organization owner can choose Tier 1 and reach Stripe Checkout.
4. Successful payment creates or updates the organization billing record through the webhook.
5. The paid organization is allowed into the application.
6. A non-paid organization is redirected to Plan & Billing.
7. Manage Billing opens the Stripe Customer Portal.
8. Subscription cancellation or status change is reflected back in Find Home First through the webhook.
