# Social publishing completion implementation plan

> Execute with the repository executing-plans workflow. User approved all design phases, existing workspace only, Meta authenticated completion, and local mocked verification on 2026-10-19. No commits, deployment, real posts, or paid campaigns.

**Goal:** Complete the approved social-publishing design through per-post analytics.

**Architecture:** Persist one tenant-owned post per request/platform; use short database transactions for claims and checkpoints and perform external HTTP outside transactions. Platform clients own delivery protocols. Module 4 owns metric snapshots. The frontend renders backend outcomes.

**Tech stack:** Existing Spring/JPA/Flyway, WebClient, React/TypeScript, JUnit/MockWebServer, Vitest.

## Tasks

- [x] Secure shared ads OAuth callback using authenticated completion; test foreign-profile, replay, denied, and successful callbacks; preserve Page/ad-account selection.
- [x] Add V50, SocialPost, tenant-scoped repository, publish/list/detail/cancel controller and service under module3/social/publish. Validate media ownership/readiness/size, approval, platforms, privacy, schedule, and tenant-owned attribution links before writing. Deduplicate requestId per tenant/platform.
- [x] Implement short atomic claims (SKIP LOCKED in Postgres), bounded retry/backoff, persistent platform checkpoints and crash recovery that does not blindly repeat uncertain external writes.
- [x] Add Facebook photo/video delivery and native scheduling; Instagram container processing/publish; TikTok photo/video inbox delivery and refresh. Cover payloads, errors, expired credentials and continuation using MockWebServer.
- [x] Create PAUSED Meta campaign/ad set/media/creative/ad with checkpoints, tenant-owned AdUrlBuilder link, optional reporting pin and Ads Manager handoff. Validate budget, objectives, countries and dates.
- [x] Replace frontend in-memory publication with API requests; expose scheduling, paid-ad form, honest outcomes, TikTok caption handoff and platform result links; test request validation and errors.
- [x] Add V51, metric snapshots, daily sync and tenant-scoped analytics endpoints under module4/postmetrics. Show unavailable data explicitly and accumulate at most seven daily reach values.
- [x] Update API/module/setup docs to the shipped contracts and local verification limits.
- [x] Run focused tests, then complete Maven and Vitest suites and TypeScript checking. Validate migrations against local Postgres if available. Check diff whitespace and LF without rewriting unrelated files. Do not run frontend build.

Completed with local verification on 2026-10-20. [Results and refinement boundaries](2026-10-20-social-publishing-verification.md).

## Verification invariants

Foreign tenants cannot publish media, use links, read posts or cancel them. A replay cannot create another post. Only one dispatcher claims a row. Successful remote stages survive retry. Tokens and raw external errors never enter post DTOs. A failed or inbox delivery never appears as published. External writes remain PAUSED for ads. No test uses real platform credentials.
