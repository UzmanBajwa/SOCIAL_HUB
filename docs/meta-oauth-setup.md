# Meta (Facebook + Instagram) OAuth Setup

SocialHub connects Facebook Pages and Instagram Business accounts through **two separate
Meta apps** (or two separate "use cases" within one Business app): Facebook uses the
classic **Facebook Login** product; Instagram uses Meta's newer **Instagram API with
Instagram Login**, which authorizes directly against Instagram and needs no Facebook
Page. Don't reuse one app's credentials for the other platform — they're different
App IDs/Secrets in different env vars (`FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` vs.
`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`).

## Part A: Facebook

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** → type **Business**.
2. In the App Dashboard, go to **Use cases** (left sidebar) → find **"Manage everything on your Page"** → **Customize** (or **Add** if it's not there yet).
   - This step is easy to miss and is the #1 cause of `Invalid Scopes: pages_show_list, pages_read_engagement, pages_manage_posts` — simply adding the "Facebook Login" product is not enough on its own; the Pages use case is what actually grants these scopes to your app.
3. On that use case's **Permissions and features** tab, add:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
4. Under **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:
   ```
   {FRONTEND_URL}/accounts/callback/facebook
   ```
5. Under **App Settings → Basic**, copy the **App ID** / **App Secret** into `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` in `backend/.env`.
6. Under **App Roles → Roles**, add yourself (and teammates) as **Admin**, **Developer**, or **Tester** — required to complete the OAuth flow and use these scopes while the app is in Development Mode, without needing App Review yet.

## Part B: Instagram

Meta now offers Instagram API access without a Facebook Page at all — the user logs in
directly with their Instagram Business/Creator account. This is what
`app/services/instagram_service.py` implements.

1. In the same (or a new) App Dashboard, go to **Use cases** → add **Instagram API** (if not already present).
2. Select the **"API setup with Instagram login"** tab (not "API setup with Facebook login" — that's the older Page-based flow this codebase doesn't use).
3. Under **Permissions and features**, add:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
4. On the same "API setup with Instagram login" page, there's a dedicated **Instagram app ID** / **Instagram app secret** (separate from any Facebook App ID) and its own redirect URI field. Register:
   ```
   {FRONTEND_URL}/accounts/callback/instagram
   ```
5. Copy the **Instagram app ID** / **Instagram app secret** into `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` in `backend/.env`.
6. The account you'll log in with to test must be an **Instagram Business or Creator account** (convert a personal account under Instagram Settings → Account type if needed) and must be added as a **Tester** for this app (App Roles → Roles) to authorize successfully before App Review.

## Development Mode is enough for testing

A new app starts in **Development Mode**, where only Admins/Developers/Testers of the
app can complete OAuth and use these scopes — anyone else gets `access_denied`. That's
completely fine for personal use or an internal beta; App Review is only required before
non-Admin/Tester users can connect their own accounts (Part D below).

## Part C: Long-lived tokens differ by platform

- **Facebook**: the initial code exchange returns a short-lived user token; `facebook_service.py` exchanges it for a long-lived user token (~60 days) before fetching Pages, and Page tokens derived from *that* are effectively non-expiring. `SocialAccount.expires_at` is `null` for Facebook connections.
- **Instagram**: the direct-login token exchange returns a short-lived token (~1h), exchanged for a long-lived token (~60 days) — but unlike Facebook Page tokens, **this one does expire** and must be refreshed. `app/scheduler/jobs.py` runs an hourly `refresh_expiring_tokens` job that refreshes any Instagram token within 10 days of expiring (`account_service.TOKEN_REFRESH_WINDOW`), calling `InstagramService.refresh_access_token()`. If a refresh fails (e.g. the user revoked access), the account is marked `expired` and needs reconnecting.

## Part D: Going to production (App Review)

`pages_manage_posts` (Facebook) and `instagram_business_content_publish` (Instagram) are
**Advanced Access** permissions. Any user who is *not* an Admin/Developer/Tester of your
app hits `access_denied` until you complete:

1. **Business Verification** (Meta Business Suite → Business Settings → Security Center).
2. **App Review** (App Dashboard → App Review → Permissions and Features) — submit each scope with a screen recording of the real flow (connect → [select Page, Facebook only] → publish). Record with `PLATFORM_SANDBOX_MODE=false` so the recording shows real API calls.
3. Switch the app from **Development** to **Live** mode once approved.

Budget for review turnaround (often 1-2 weeks, sometimes longer with clarification
rounds) when planning a launch date.

## ngrok is a development convenience only

If you need a public HTTPS URL to test on another device, `ngrok http 5173` works, but:
- ngrok's free tier issues a new URL every restart — you'd re-register the redirect URI in both Meta apps and update `FRONTEND_URL`/`CORS_EXTRA_ORIGINS` each time.
- Never point production `FRONTEND_URL` at an ngrok URL — use a real domain instead.

## Troubleshooting

- **`Invalid Scopes: pages_show_list, pages_read_engagement, pages_manage_posts`** — the "Manage everything on your Page" use case isn't added/customized yet (Part A, step 2).
- **`redirect_uri mismatch`** — the URI sent doesn't byte-for-byte match what's registered (check http vs https, trailing slashes). Facebook and Instagram redirect URIs are registered in *different* places (Facebook Login settings vs. the Instagram app's own API setup page) — make sure you registered each in the right app.
- **`access_denied` immediately on consent** — the account isn't an Admin/Developer/Tester of the relevant app yet.
- **"No Facebook Pages found"** — the account doesn't administer any Page.
- **Instagram token stops working after ~2 months** — expected if the scheduler's refresh job didn't run (e.g. backend was down for an extended period) or the user revoked access; reconnect the account.
