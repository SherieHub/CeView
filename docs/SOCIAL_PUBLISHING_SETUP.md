# Social publishing — platform and AWS setup

One-time setup for CVW-55 (connect Facebook / Instagram / TikTok, publish, Meta Ads handoff).
Design: `docs/superpowers/specs/2026-10-19-social-publishing-design.md`. Ad-account reporting
setup (the existing `ads_read` connection) stays in `AD_PLATFORM_SETUP.md`.

Everything here is free. Console labels change; if one differs, follow the intent.

> **Database:** the social connection tables (V48/V49: `tbl_media_asset`, `tbl_publishing_account`)
> exist only on Postgres. The native H2 "Path B" profile in `RUNNING.md` does not create them, so
> Settings → Platforms and Content Studio publishing need the Docker/Postgres path (Path A).
>
> **Limits:** the Facebook Page picker lists at most the first 100 Pages a Meta login administers;
> Pages beyond that are not shown.

## A. Media storage on AWS (needed from Phase 1)

Uploaded images and videos live in their own private S3 bucket, served publicly through the
**existing** CloudFront distribution under `/media/*`. That keeps one domain (`ceview.online`),
needs no new certificate or DNS record, and gives TikTok a URL prefix it can verify.

1. **Bucket.** S3 → Create bucket → `ceview-prod-media-410133709862`, region `ap-southeast-1`,
   **Block all public access ON**, default encryption SSE-S3. Do not enable versioning.
2. **Bucket CORS** (the browser uploads straight to S3). Bucket → Permissions → Cross-origin
   resource sharing → paste `deploy/aws/s3/media-bucket-cors.json`.
3. **CloudFront origin.** CloudFront → distribution `E2MGMAODXCEDZG` → Origins → Create origin:
   the media bucket, Origin access = **Origin access control** (create new, defaults).
   CloudFront shows a "Copy policy" banner: open the media bucket → Permissions → Bucket policy
   and paste it.
4. **CloudFront behavior.** Behaviors → Create behavior:
   - Path pattern `/media/*`, origin = the media bucket.
   - Viewer protocol: Redirect HTTP to HTTPS. Allowed methods: GET, HEAD.
   - Cache policy: CachingOptimized.
   - **No function association.** The `ceview-spa-rewrite` function rewrites extension-less
     paths to `/index.html` and must stay on the default behavior only.
5. **IAM user.** IAM → Users → Create user `ceview-media` (no console access) → attach a new
   policy from `deploy/aws/iam/media-user-policy.json` → Security credentials → Create access key
   (use case: application running outside AWS). Save the key pair in your password manager.
6. **Parameter Store** (region `ap-southeast-1`, type SecureString), under `/ceview/prod/`:
   `MEDIA_BUCKET` = `ceview-prod-media-410133709862`, `MEDIA_AWS_ACCESS_KEY_ID`,
   `MEDIA_AWS_SECRET_ACCESS_KEY`.
7. **Deploy** as usual (push to `release`). The server re-reads parameters on each deploy; after
   changing one by hand run `sudo /opt/ceview/current/scripts/fetch-secrets.sh && sudo ceview-compose up -d`.

   Render (`render.yaml`) deployments have no media storage configured; uploads need the AWS setup
   above (local-disk storage is development-only).

   A presigned upload URL stays valid for `MEDIA_PRESIGN_MINUTES` (default 15) even after the upload
   is marked complete, and a PUT is pinned to the declared size and Content-Type. Phase 3 publishing
   must re-check the stored object's size (HEAD) immediately before handing a URL to a platform.

**Check it works** (after a deploy, logged in, replace TOKEN):

```bash
curl -s -X POST https://api.ceview.online/api/media/uploads \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","sizeBytes":4}'
# copy uploadUrl / mediaId / publicUrl from the response
printf 'test' | curl -s -X PUT -H "Content-Type: image/jpeg" --data-binary @- "<uploadUrl>"
curl -s -X POST https://api.ceview.online/api/media/<mediaId>/complete \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{}'
curl -sI "<publicUrl>"   # expect HTTP/2 200 from CloudFront
```

Rotate the `ceview-media` key quarterly alongside the `ceview-box` key (DEPLOY_AWS.md B18).
Cost: S3 storage is cents per GB-month at pilot scale; CloudFront egress stays inside the
always-free 1 TB/month.

## B. Meta app (needed from Phase 2)

Uses the existing app (`META_APP_ID`). In developers.facebook.com → your app:

1. Products: **Facebook Login** (already used for ads), plus access to the Pages API and the
   Instagram API / Marketing API as the dashboard offers them.
2. Permissions the single Meta login will request (Phase 2 sets the scope string):
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`,
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `ads_management`,
   `ads_read`, `business_management`.
3. Valid OAuth redirect URI (already registered): `https://api.ceview.online/api/ad-connections/meta/callback`.
4. **Development mode:** App roles → add every demo operator as **Tester** (or Developer). In dev
   mode only role-holders can grant permissions; that is all the capstone/demo needs.
5. Each demo Instagram account must be a **Business or Creator** account linked to a Facebook
   **Page** the tester administers.

## C. TikTok for Developers app (needed from Phase 2)

Separate from the TikTok For Business ads app.

1. developers.tiktok.com → Manage apps → Connect an app.
2. Add products **Login Kit** and **Content Posting API**; request scopes `user.info.basic`,
   `video.upload`, `video.list`.
3. Redirect URI: `https://api.ceview.online/api/social-connections/tiktok/callback`.
4. Use **Sandbox** and add each demo TikTok account as a target user.
5. **URL prefix verification:** `PULL_FROM_URL` only works for verified prefixes. Verify
   `https://ceview.online/media/` using the method the portal shows (DNS TXT record on the domain,
   or a signature file — if a file, upload it to the media bucket under `media/`).
6. Parameter Store: `TIKTOK_CONTENT_CLIENT_KEY`, `TIKTOK_CONTENT_CLIENT_SECRET`.

## D. Beyond testers (not part of the capstone build)

- **Meta:** Business Verification, then App Review for every permission above, with screen
  recordings of each use. Free; plan for weeks. Switch the app to Live mode.
- **TikTok:** an audit of the app. Until it passes, content posted by the API is private-only.
- **Graph API version:** the shared login, Page, publishing and insight clients use `v25.0`.
  Override `META_GRAPH_BASE_URL` and `META_DIALOG_URL` together when upgrading; re-test insight fields and permissions before App Review.

## E. Delivery and local verification

Publishing now persists uploads, grants, post lifecycle/checkpoints and metric snapshots (V48–V52). Run the Postgres path; H2 remains a test-only stand-in for these new tables. Local compose passes the media and creator-app environment variables and persists local uploads in `ceview-media-uploads`.

OAuth public callbacks only redirect to Settings; the authenticated SPA completes each exchange using its own JWT. A state belonging to another profile is consumed and rejected. Existing Meta ads-only grants must reconnect for publishing permissions and select a Page again. Page/Instagram disconnection discards publishing tokens while retaining the ads grant.

Facebook uses native scheduling; Instagram and TikTok use the dispatcher. `SOCIAL_DISPATCH_ENABLED` (default true), `SOCIAL_DISPATCH_DELAY_MS` (30000), `SOCIAL_METRICS_ENABLED` (true), and `SOCIAL_METRICS_CRON` (03:00 UTC) configure jobs. Jobs perform platform HTTP calls outside database transactions. Token refresh is serialized across workers using a short lease. Rate-limit retries are bounded; an uncertain write or interrupted process requires checking the platform before making another post.

Instagram images must be JPEG. TikTok photos must be JPEG or WEBP. Video goes through platform processing before delivery is reported. TikTok receives inbox drafts, not direct posts; users choose final privacy in TikTok. Video inbox drafts do not carry captions, so copy the caption from CeView's post detail. Metrics remain unavailable until the platform exposes a public post ID and returns the relevant fields.

Meta ads are created PAUSED at every stage. The Publish window uses the connected ad account's currency, the surge window's dates and a tenant-owned campaign tracking link. Successful campaign/ad-set/media/creative stages survive retries. Changing the selected ad account or Page prevents resuming work against a different account. Review and launch in Ads Manager; CeView never launches the ad.

**Targeting.** The audience follows the forecast market: its country (Korea → KR, Japan → JP, USA → US) and, for Korea and Japan, its language (Korean, Japanese; the USA has none). The server derives these, so a client cannot aim an ad elsewhere. The operator adds up to 10 optional interests, searched live from Meta, and may let Meta widen the audience (Advantage+ audience, off by default). No age or gender is sent, because the forecast has no demographic data.

**Spending limits.** A paid ad is blocked until the business saves a daily and a total limit under Settings → Platforms → Ad spending limits (in the ad account's currency). The total counts every not-yet-ended, not-failed CeView ad, so several ads cannot add up past it. A daily budget at or below Meta's own minimum for the objective (read from `minimum_budgets`) is refused before anything is sent to Meta.

**Verify live (not confirmed against a real account).**

- `minimum_budgets` amounts are documented as int32 in the account currency but not whether they are minor units. They are treated as minor units; the first live read for a Philippine account should be near `6332` (PHP 63.32), which Meta quoted when it rejected a ₱10 budget.
- The Advantage+ field `targeting_automation.advantage_audience` (0/1) is taken from secondary sources, not Meta's own reference.
- Engagement uses ad set `optimization_goal=POST_ENGAGEMENT` and `promoted_object: {page_id}` (the connected Facebook Page); without the Page Meta refused the final `/ads` call ("Your campaign must include an ad set with a selected object to promote"). With only the Page attached Meta refused the ad set ("Performance goal isn't available", subcode 2490408), so `destination_type: ON_POST` is also sent; that combination is a best guess and not yet confirmed against a live account (Meta's reference calls the `ON_*` destinations a limited beta and gives no goal mapping). Traffic and Awareness send no promoted object or destination type.
- `adinterestvalid` is used to drop interests Meta has retired; an interest missing from its answer is not blocked, since Meta rejects it itself at ad set creation.

When Meta rejects an ad, the rejection (status, code, subcode, message, trace id and path; never the token or query string) is logged as `Platform rejected a delivery call`, and Meta's own explanation is shown on the failed post. Both are the first place to look when an ad fails.

Local verification uses MockWebServer, MockMvc, Vitest, Playwright route fixtures and isolated Postgres. It does not validate actual consent screens, production callbacks, App Review, verified media prefixes or live delivery. Those require the tester-account refinement pass agreed with the user. Do not use real platform credentials in automated tests.
