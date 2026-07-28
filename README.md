# SocialHub

SocialHub is a simplified Metricool-style social media publishing platform. Users connect
**Facebook Pages** and **Instagram Business accounts**, then publish or schedule a single
post across either or both from one dashboard.

This is an MVP focused purely on **account connection + post publishing/scheduling**. Analytics,
inbox, AI tooling, and other Metricool-style modules are intentionally out of scope, but the
codebase is structured so those modules can be added later without a rewrite (see
[docs/architecture.md](docs/architecture.md)).

LinkedIn and YouTube integrations exist in the codebase (`app/services/linkedin_service.py`,
`app/services/youtube_service.py`) but are switched off by default via `ENABLED_PLATFORMS`
and hidden from the UI — see [Future Platforms](#future-platforms-linkedin--youtube) below.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, shadcn-style UI, React Query, React Router, React Hook Form |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, APScheduler, Alembic |
| Database | PostgreSQL |
| Auth | JWT (access + refresh), OAuth2 for social providers |
| Storage | Local disk (dev), Cloudflare R2 / S3-compatible (prod) |

## Project Structure

```
/socialhub
  /backend         FastAPI application
    /app
      /api          Route handlers (thin, no business logic)
      /models       SQLAlchemy ORM models
      /schemas      Pydantic request/response schemas
      /services     Business logic + per-platform integrations
      /scheduler    APScheduler jobs for scheduled publishing
      /auth         JWT + password hashing utilities
      /database     Engine/session management
      /utils        Shared helpers (validation, file handling)
    /alembic        DB migrations
    /uploads        Local media storage (dev only)
  /frontend         React SPA
  /docs             Architecture notes
```

## Getting Started

### Option A — Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:5173
- Postgres: localhost:5432

### Option B — Manual local setup

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # edit DATABASE_URL, SECRET_KEY, OAuth creds
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

**Or, once both are set up once:** run `.\start-socialhub.ps1` from the project root to
launch backend + frontend (+ optionally ngrok) in separate windows.

## Environment Variables

See `backend/.env.example` for the full list, and `backend/.env.production.example` for
production-appropriate defaults. Key ones:

- `SECRET_KEY` — JWT signing secret (generate with `openssl rand -hex 32`)
- `ENCRYPTION_KEY` — Fernet key used to encrypt stored OAuth tokens at rest (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)
- `DATABASE_URL` — e.g. `postgresql+asyncpg://socialhub:socialhub@localhost:5432/socialhub`
- `FRONTEND_URL` / `BACKEND_URL` — the only things that change between dev/staging/prod. Every OAuth redirect URI and the CORS allow-list are derived from these (see `app/config.py`'s `redirect_uri()`/`cors_origin_list`) — no per-platform redirect URI env vars to keep in sync.
- `ENABLED_PLATFORMS` — comma-separated list gating which platforms users can connect (`facebook,instagram` by default). Enforced in `app/api/accounts.py`.
- `STORAGE_BACKEND` — `local` or `r2`
- `PLATFORM_SANDBOX_MODE` — `true` in development (simulated publishes), `false` in production (real API calls)
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` — Facebook Login app credentials.
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` — a **separate** Meta app for Instagram (direct Instagram Login, no Facebook Page needed). See [docs/meta-oauth-setup.md](docs/meta-oauth-setup.md) for creating both.
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`, `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` — unused while those platforms are disabled; kept for a future release.

## Core Flows

1. **Register/Login** → JWT access + refresh tokens issued, stored client-side, attached as `Authorization: Bearer`.
2. **Connect account** → clicking "Connect" on the Accounts page opens the provider's OAuth consent screen in a **popup window** (`GET /accounts/connect/{platform}` returns the authorize URL). The provider redirects the popup back to `/accounts/callback/{platform}`, which posts `{platform, code, state}` to `POST /accounts/connect`.
   - That response comes back with `requires_selection: true` and a list of candidates: for Facebook, every Page the user administers; for Instagram (direct Instagram Login — no Facebook Page involved), always exactly one candidate, the Instagram Business account itself. The popup shows this picker either way (confirming the single Instagram account, or choosing among several Facebook Pages), and `POST /accounts/connect/select` finalizes the chosen one as the connected `SocialAccount`.
   - The popup then `postMessage`s the opener window and closes itself; the Accounts page refetches and shows the new connection — no full-page navigation away from the app.
3. **Create post** → `POST /posts` stores the post + selected platforms as `draft`. Instagram requires media (image/video); Facebook does not — enforced both client-side and in `app/utils/validators.py`.
4. **Publish now** → `POST /posts/{id}/publish` fans out to one async task per selected platform (`PostPlatform` row each), calling that platform's `publish_post()`. One platform failing does not roll back the others — each `PostPlatform.status` is independent.
5. **Schedule** → `POST /posts/{id}/schedule` sets `publish_date` + status `scheduled`. An APScheduler job polls every 60s for due posts and publishes them the same way as "Publish now".

## Testing the publishing flow without real API credentials

Each platform service validates the presence of OAuth credentials before making live calls. If you
want to exercise the full pipeline without registering real developer apps, set
`PLATFORM_SANDBOX_MODE=true` in `backend/.env` — the services will simulate a successful
publish response (with a fake `platform_post_id`) instead of calling the real API, so you can
verify the UI, database records, and scheduler end-to-end. Turn it off for real publishing.

## Database Migrations

```bash
cd backend
alembic upgrade head    # applies 0001_initial_schema + 0002_social_account_enrichment
```

`0002` adds `account_username`, `scopes`, and `extra_data` (JSONB) to `social_accounts` to
support the Facebook/Instagram page-selection flow. Run this after pulling if you have an
existing database from before this change.

## Production Deployment

1. Copy `backend/.env.production.example` → `backend/.env` on the production host, fill in real secrets (never commit the filled-in file).
2. Set `FRONTEND_URL`/`BACKEND_URL` to your real HTTPS domains — this alone updates every OAuth redirect URI and the CORS allow-list.
3. Register the resulting redirect URIs (`{FRONTEND_URL}/accounts/callback/facebook` and `.../instagram`) in the Meta App dashboard — see [docs/meta-oauth-setup.md](docs/meta-oauth-setup.md).
4. Set `PLATFORM_SANDBOX_MODE=false` and `STORAGE_BACKEND=r2`.
5. Run `alembic upgrade head` against the production database.
6. Complete Meta's Business Verification + App Review before any user outside your app's Admins/Testers can connect an account (see [docs/meta-oauth-setup.md](docs/meta-oauth-setup.md), section 5) — this is a Meta-side approval process, not something this codebase can bypass.
7. Do not use ngrok in production — it's a development-only convenience for exposing `localhost` publicly (see `start-socialhub.ps1` and section 7 of the Meta setup doc).

## Future Platforms: LinkedIn & YouTube

`app/services/linkedin_service.py` and `app/services/youtube_service.py` already
implement the full `PlatformService` interface (connect/disconnect/publish/validate) and
are exercised by the same scheduler and publish pipeline as Facebook/Instagram — they're
switched off only via `ENABLED_PLATFORMS` and hidden from the frontend's
`SUPPORTED_PLATFORMS` constant (`frontend/src/types/index.ts`). To re-enable either:

1. Add the platform back to `ENABLED_PLATFORMS` in `backend/.env`.
2. Add it back to `SUPPORTED_PLATFORMS` in `frontend/src/types/index.ts`.
3. Fill in that platform's OAuth credentials.

What's *not* built yet for them: the multi-account page/channel-selection flow Facebook
and Instagram now have (LinkedIn/YouTube still use the older single-shot `connect()` that
auto-selects the first result) and per-platform media validation rules (e.g. YouTube
requiring a video). Both are straightforward extensions of the same pattern used for
Facebook/Instagram in `app/services/account_service.py` and `app/utils/validators.py`.

## License

MIT (internal project scaffold — replace as needed).
