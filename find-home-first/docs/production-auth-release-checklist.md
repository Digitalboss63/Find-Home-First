# Production Authentication Release Checklist

Use this checklist every time Find Home First — or another Clerk-backed Claytara app following this protocol — moves from development/test authentication to production.

## 1. Clerk production instance

- Confirm the app is using the Clerk **Production** instance.
- Put the production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the production runtime.
- Redeploy after changing either key.
- Load the production sign-in screen and confirm no Development mode label appears.

## 2. Production domain and DNS

- In Clerk Production, verify the primary domain.
- Add/verify every Clerk DNS record required for the custom auth domain and mail/DKIM records.
- Re-check the application apex and `www` DNS records after Clerk DNS changes so hosting records were not removed or overwritten.
- Verify both supported application URLs resolve before continuing.

## 3. Platform owner identity

Development and Production Clerk users have different user IDs.

- Open Clerk Production → Users → platform owner.
- Copy the full Production **User ID**.
- Set `PLATFORM_OWNER_CLERK_USER_ID` in the production runtime to that Production ID.
- If billing-support users are configured, populate `BILLING_SUPPORT_CLERK_USER_IDS` with their Production Clerk IDs.
- Redeploy.
- Sign in as the owner and verify **Back Office** appears in the app navigation.
- Open `/back-office` and verify owner-only pages load.

## 4. Google OAuth production connection

- In Clerk Production → Google connection, enable custom credentials.
- Use the intended production Google OAuth 2.0 Web application Client ID and Client Secret.
- Copy the **Authorized Redirect URI** shown by Clerk Production.
- In Google Cloud → APIs & Services → Credentials → matching OAuth 2.0 Web application, add that exact value under **Authorized redirect URIs**.
- Do not reuse an old redirect URI from another Clerk instance or custom domain.
- Add the production app origins used by the app under **Authorized JavaScript origins** where required.
- Verify the OAuth consent configuration is suitable for production use.
- Save the Google client, then save the Clerk Google connection.

## 5. Live authentication acceptance

On the real production domain:

- Sign in using the normal email path.
- Sign out.
- Sign in using Google.
- Confirm there is no `Missing required parameter: client_id` error.
- Confirm there is no `redirect_uri_mismatch` error.
- Confirm the user returns to the application after successful Google authentication.
- Sign in as the platform owner and verify Back Office remains visible.
- Sign in as a normal non-owner user and verify Back Office is not available.

## 6. Production presentation

- Remove/suppress demo-only or development-only notices unless intentionally running a demo environment.
- Confirm production pricing and billing copy are correct.
- Confirm production links return to the production domain rather than localhost/internal hosting URLs.

## 7. Release evidence

Before marking production authentication complete, record:

- release commit / PR;
- Clerk Production instance used;
- production domain verification result;
- owner Back Office verification result;
- email sign-in result;
- Google sign-in result;
- any remaining unverified item.

Never record secret credential values in the release report.
