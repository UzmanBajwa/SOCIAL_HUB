# Architecture Notes

## Why the layout is future-proof

- **`services/` is per-platform + per-domain, not per-route.** `facebook_service.py`,
  `instagram_service.py`, `linkedin_service.py`, `youtube_service.py` all implement the same
  informal interface (`connect`, `disconnect`, `publish_post`, `upload_media`, `validate_token`).
  Adding TikTok, Pinterest, or Threads means adding one new file and one entry in
  `services/registry.py` — no route or scheduler code changes.
- **`PostPlatform` is a join row with its own status**, not a column on `Post`. This is what lets
  a single post fan out to N platforms with independent success/failure, retry counts, and
  provider-returned IDs — required for Bulk Scheduling and per-platform Analytics later.
- **`Media` is modeled independently of `Post`** (many-to-many via `media_url` references today,
  promotable to a join table later) so a **Media Library** can be layered on without touching the
  post schema.
- **`storage.py` is an abstract backend** (`LocalStorage` / `R2Storage` behind `get_storage()`) so
  switching dev→prod storage is an env var, and a future CDN/media-library feature reuses the same
  interface.
- **Scheduler jobs are separate from publish logic.** `scheduler/jobs.py` only queries due posts
  and calls `post_service.publish_post_platforms(...)` — the same function the `/publish` route
  calls. Bulk scheduling later just means enqueuing more rows; the job loop doesn't change.
- **Auth is JWT + a pluggable OAuth flow per provider**, so Team Members / roles can be added by
  extending `User` and adding a `role` check dependency in `auth/deps.py` without touching how
  tokens are issued.
- **Encrypted-at-rest tokens** (`services/encryption.py`, Fernet) mean refresh-token rotation and
  multi-account-per-platform support don't require a data migration for security later.
- **Notifications / Approval Workflow** can hook into `post_service` status transitions
  (`draft → scheduled → publishing → published/failed`) since those transitions are centralized in
  one place rather than scattered across routes.

## Explicitly out of scope for this MVP

Analytics, Social Inbox, AI Caption/Hashtag generation, Content Calendar UI, Team Members,
Approval Workflows, Notifications, Bulk Scheduling, TikTok/Pinterest/Threads. The data model and
service boundaries above exist specifically so none of these require restructuring existing code.
