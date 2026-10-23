# Social publishing verification — 2026-10-20

The implementation covers all delivery phases in the approved design, continuing from the pre-existing media and connection edits. Work remained in this workspace. No commits, deployment, real platform posts or paid campaign launches were performed.

## Delivered behavior

- Media uploads support images and videos, verify storage, and carry tenant-owned media IDs into publication.
- Meta uses one publishing/ads grant with Page and linked Instagram selection. TikTok creator login remains separate from TikTok Ads. Public callbacks only redirect; authenticated completion binds consumed state to the caller.
- Persisted post requests support distinct captions, idempotency, immediate delivery, schedules, cancellation, durable remote-stage checkpoints and bounded rate-limit retries. Ambiguous external writes require inspection instead of automatic reposting.
- Facebook schedules natively; Instagram media processing and TikTok inbox delivery resume asynchronously. TikTok drafts are confirmed before reporting inbox success. Private settings and final publication are chosen in TikTok; video captions have a copy handoff.
- Meta creates PAUSED campaign, ad set, media, creative and ad, using a selected owned tracking link and account currency. Optional Performance pinning cannot overwrite a concurrently changed grant. Page/ad-account changes prevent resuming against a different account.
- Daily post metrics feed Performance. Individual unavailable values stay null. TikTok requires public post IDs; Meta ad insights provide paid reach without inventing organic interactions. Ads enter the delivered list only when positive reach is reported. Missing reach history remains empty/null.
- Configuration failures, revoked credentials, foreign resource IDs, slow list responses, mixed platform outcomes and offset timestamps are handled explicitly.

## Completed checks

| Check | Result |
|---|---|
| Complete JDK 21 Maven suite | 737 passed; the opt-in Postgres test skipped in this run |
| Opt-in `SocialPublishingPostgresTest` | 1 passed; combined backend reports: 738 passed, no failures/errors |
| Complete Vitest suite | 988 passed, 14 skipped (123 passing files, 4 skipped files) |
| `npx tsc --noEmit` | Exit 0 |
| Local Playwright social publishing suite | 6 passed |
| Local Docker Compose syntax | `config --no-interpolate --quiet`: exit 0 |
| Source whitespace and LF | Clean, excluding the pre-existing generated `frontend/dist/index.html` change |

Postgres verification used a disposable local pgvector/Postgres 16 container, not the existing development database. Flyway applied migrations through V52, Hibernate schema validation passed, and simultaneous transactions claimed different due posts using `FOR UPDATE SKIP LOCKED`. Authenticated API reads, unavailable TikTok configuration and the public callback were also checked against Postgres.

Browser coverage exercised scheduled, failed and TikTok inbox outcomes, paid-ad validation, Page selection, missing linked Instagram, ACTIVE connections, reconnect requirements and disabled unconfigured providers. Connection screenshots were inspected. Generated logs/screenshots are preserved under the ignored `backend/spring-boot/target/` directory.

Several tracked files use CRLF in HEAD, while the supplied plan requires LF. Changed source files use LF; `git diff --ignore-space-at-eol` isolates behavioral changes. The pre-existing generated frontend artifact was retained as found, and no frontend production build ran.

## Reproducing the optional database check

Use a disposable local database with user `ceview` and password `local-verification-only`. Set `CEVIEW_SOCIAL_POSTGRES_TEST_URL=jdbc:postgresql://127.0.0.1:<port>/<database>` and run `./mvnw.cmd -q test -Dtest=SocialPublishingPostgresTest` with JDK 21. The opt-in condition accepts only localhost URLs. Repeated runs use distinct tenant/media fixtures.

## Later tester-account refinement

Automated tests use mocked platform endpoints. Actual consent screens, public HTTPS callbacks, live Facebook/Instagram delivery, TikTok verified media prefixes/inbox behavior, Meta account-specific ad requirements, App Review and real insight availability still require tester accounts. This is the later refinement pass explicitly requested by the user. Ads remain PAUSED; launch/review occurs in Ads Manager.

Instagram image validation requires JPEG; TikTok photos require JPEG/WEBP. Unsupported formats receive actionable validation errors. Platform API differences or account permissions discovered in live refinement may require adjusting those clients; local success does not establish real platform delivery.
