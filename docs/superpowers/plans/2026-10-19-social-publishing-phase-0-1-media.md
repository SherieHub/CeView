# Social Publishing — Phase 0 (setup) + Phase 1 (media storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rule (CLAUDE.md): never run `git commit` or `git push`.** Every "Checkpoint" step below means: stop, list the changed files for the user, and let them commit. Do not replace this with a commit.

**Goal:** Let an operator upload an image or video from Content Studio to storage that gives it a public HTTPS URL (S3 + CloudFront in production, local disk in dev), and lay down the AWS/config/docs groundwork that later phases (connections, publishing, ads) depend on.

**Architecture:** A tenant-scoped `module3.media` package. `POST /api/media/uploads` validates type and size, stores a `tbl_media_asset` row (PENDING) and returns a presigned S3 PUT URL (or a local-dev PUT endpoint). The browser PUTs the file straight to storage, then calls `POST /api/media/{id}/complete`, which verifies the object exists and flips the row to READY. The composer keeps its existing data-URL preview (for videos: a poster frame) so the compliance audit and all previews keep working, and uploads in the background.

**Tech Stack:** Spring Boot 3.3.4 (Maven, `backend/spring-boot/pom.xml`), JPA/Flyway/Postgres, AWS SDK v2 (`s3`), JUnit 5 + MockMvc + AssertJ; React 19 + TypeScript + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-10-19-social-publishing-design.md` (Phases 0 and 1).

## Deviations from the spec (decided while planning, spec is updated in Task 2)

1. **Dedicated IAM user for media.** The spec said to widen `deploy/aws/iam/box-user-policy.json`. This plan instead creates a separate `ceview-media` IAM user with a policy limited to the media bucket (`deploy/aws/iam/media-user-policy.json`). The Spring container needs long-lived keys to presign URLs (Lightsail has no instance roles); giving it the `ceview-box` key would also hand it ECR pull and Parameter Store read access.
2. **`s3:ListBucket` is required** on the media bucket. Without it S3 answers a HEAD on a missing key with 403, not 404, and the "was the file really uploaded?" check cannot tell the difference.
3. **Per-platform image formats are not enforced in Phase 1.** The composer already accepts PNG/JPG/WEBP. Instagram's publish API reportedly accepts JPEG only, and TikTok photo posts reportedly JPEG/WEBP only. Phase 3's publishers must validate or convert; verify against current docs then.

## Not in this plan

- The `db/h2` Flyway mirror (stops at V24, already drifted from Postgres V47). Tests use `ddl-auto=create-drop`; local runs use Postgres via `backend/docker-compose.yml`.
- Cleanup of abandoned uploads (PENDING rows, objects for removed media). Phase 3 revisits this once posts reference media.
- Reading image dimensions client-side. Videos report width/height/duration (free during poster capture); Phase 3 publishers validate aspect ratios.
- Upload progress bars (indeterminate "Uploading…" only).

## File structure

**Create (backend, `backend/spring-boot/src/main/java/com/ceview/module3/media/`):**
- `MediaPolicy.java` — allowed content types, kinds, extensions, size caps. Pure.
- `MediaAsset.java`, `MediaAssetRepository.java` — JPA entity/repo for `tbl_media_asset`.
- `MediaStorage.java` — interface: upload URL, size lookup, delete.
- `LocalMediaStorage.java` — disk implementation (dev/tests) with a size-capped `write`.
- `S3MediaStorage.java` — presigned PUT + HEAD + delete.
- `UnconfiguredMediaStorage.java` — 503s when `s3` is selected but no bucket is set.
- `MediaConfig.java` — chooses the storage bean from `ceview.media.storage`.
- `LocalMediaWebConfig.java` — serves `/media/**` from disk in local mode.
- `MediaDtos.java`, `MediaService.java`, `MediaController.java` — the tenant-scoped API.
- `LocalMediaUploadController.java` — the dev-only PUT target.
- `backend/spring-boot/src/main/resources/db/migration/V48__module3_media_asset.sql`

**Create (backend tests, `backend/spring-boot/src/test/java/com/ceview/module3/media/`):** `MediaPolicyTest`, `LocalMediaStorageTest`, `S3MediaStorageTest`, `MediaConfigTest`, `MediaControllerTest`, `LocalMediaUploadTest`.

**Modify (backend):** `pom.xml`, `application.yml`, `src/test/resources/application.properties`, `config/SecurityConfig.java`, `auth/ProfileCompletionFilter.java`, root `.gitignore`.

**Create (frontend):** `frontend/services/mediaUpload.ts` (+ test), `frontend/components/module-3/3.1-content-studio/{MediaPreview.tsx, videoPoster.ts}` (+ `MediaPreview.test.tsx`).

**Modify (frontend):** `frontend/types.ts`, `frontend/services/apiClient.ts`, `…/contentStudioTypes.ts`, `…/PublishComposer.tsx` (+ test), `…/DevicePreview.tsx`, `…/ValidateStage.tsx`, `…/PublishModal.tsx`, `…/ContentStudioView.tsx`, `…/AttachStage.tsx`, `frontend/styles/index.css`, `frontend/styles/studio.css`.

**Create/modify (deploy + docs):** `deploy/aws/iam/media-user-policy.json`, `deploy/aws/s3/media-bucket-cors.json`, `deploy/aws/docker-compose.prod.yml`, `backend/.env.example`, `docs/SOCIAL_PUBLISHING_SETUP.md`, `AD_PLATFORM_SETUP.md`, the spec.

Commands below assume Git Bash from the repo root `C:\Users\austi\CeView`. Backend: `cd backend/spring-boot && ./mvnw -q test -Dtest=<Class>`. Frontend: `cd frontend && npx vitest run <path>`.

---

# PHASE 0 — Setup, config and docs

### Task 1: Deploy config for media (IAM policy, bucket CORS, compose, env example, app config)

**Files:**
- Create: `deploy/aws/iam/media-user-policy.json`
- Create: `deploy/aws/s3/media-bucket-cors.json`
- Modify: `deploy/aws/docker-compose.prod.yml` (spring-boot `environment:` block, after the `OAUTH_REDIRECT_BASE_URL` line)
- Modify: `backend/.env.example`
- Modify: `backend/spring-boot/src/main/resources/application.yml` (new `ceview.media` block, before `  cors:`)
- Modify: `backend/spring-boot/src/test/resources/application.properties`
- Modify: `.gitignore`

- [ ] **Step 1: Create the media IAM policy**

`deploy/aws/iam/media-user-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteDeleteMediaObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::ceview-prod-media-410133709862/media/*"
    },
    {
      "Sid": "ListMediaBucketSoMissingKeysAre404Not403",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::ceview-prod-media-410133709862"
    }
  ]
}
```

- [ ] **Step 2: Create the bucket CORS rule (browser PUTs straight to S3)**

`deploy/aws/s3/media-bucket-cors.json`:

```json
[
  {
    "AllowedOrigins": ["https://ceview.online"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```

- [ ] **Step 3: Wire the container environment**

In `deploy/aws/docker-compose.prod.yml`, after the line `      OAUTH_REDIRECT_BASE_URL: https://api.${DOMAIN}` add:

```yaml
      # Media uploads (docs/SOCIAL_PUBLISHING_SETUP.md part A). The app presigns S3 PUT
      # URLs with its own least-privilege ceview-media key, not the server's ceview-box
      # key. Left unset, the media endpoints answer 503 instead of the app failing to boot.
      MEDIA_STORAGE: s3
      MEDIA_AWS_REGION: ${AWS_REGION}
      MEDIA_BUCKET: ${MEDIA_BUCKET:-}
      MEDIA_AWS_ACCESS_KEY_ID: ${MEDIA_AWS_ACCESS_KEY_ID:-}
      MEDIA_AWS_SECRET_ACCESS_KEY: ${MEDIA_AWS_SECRET_ACCESS_KEY:-}
      # The origin CloudFront serves /media/* from; TikTok must verify this prefix too.
      MEDIA_PUBLIC_BASE_URL: https://${DOMAIN}
      # TikTok app credentials (ads app today; the content-posting app arrives in Phase 2).
      TIKTOK_APP_ID: ${TIKTOK_APP_ID:-}
      TIKTOK_APP_SECRET: ${TIKTOK_APP_SECRET:-}
      TIKTOK_CONTENT_CLIENT_KEY: ${TIKTOK_CONTENT_CLIENT_KEY:-}
      TIKTOK_CONTENT_CLIENT_SECRET: ${TIKTOK_CONTENT_CLIENT_SECRET:-}
```

`fetch-secrets.sh` already renders every parameter under `/ceview/prod/` into the compose env file, so no script change is needed.

- [ ] **Step 4: Document the variables for local dev**

Open `backend/.env.example`, find the `META_APP_ID` / `TIKTOK_APP_ID` block (around lines 44–55) and append after it:

```
# Media uploads (Content Studio). "local" stores files under MEDIA_LOCAL_DIR and serves
# them from /media/** (fine for dev); production sets MEDIA_STORAGE=s3 plus the bucket
# and the ceview-media IAM key (docs/SOCIAL_PUBLISHING_SETUP.md part A).
MEDIA_STORAGE=local
MEDIA_PUBLIC_BASE_URL=http://localhost:8080
MEDIA_LOCAL_DIR=./media-uploads
# MEDIA_BUCKET=
# MEDIA_AWS_REGION=ap-southeast-1
# MEDIA_AWS_ACCESS_KEY_ID=
# MEDIA_AWS_SECRET_ACCESS_KEY=
```

- [ ] **Step 5: Add the `ceview.media` block to application.yml**

In `backend/spring-boot/src/main/resources/application.yml`, insert immediately before the line `  cors:` (the one followed by `allowed-origins: ${CORS_ALLOWED_ORIGINS:`):

```yaml
  media:
    # "s3" in production (compose sets it); "local" keeps uploads on disk for dev and tests.
    storage: ${MEDIA_STORAGE:local}
    # Origin that serves uploaded files. Platforms fetch media from here, so it must be
    # public HTTPS in production (TikTok additionally verifies this URL prefix).
    public-base-url: ${MEDIA_PUBLIC_BASE_URL:http://localhost:8080}
    local-dir: ${MEDIA_LOCAL_DIR:./media-uploads}
    s3:
      bucket: ${MEDIA_BUCKET:}
      region: ${MEDIA_AWS_REGION:ap-southeast-1}
      # Blank = fall back to the SDK's default credential chain (env, ~/.aws).
      access-key-id: ${MEDIA_AWS_ACCESS_KEY_ID:}
      secret-access-key: ${MEDIA_AWS_SECRET_ACCESS_KEY:}
      presign-minutes: ${MEDIA_PRESIGN_MINUTES:15}
```

- [ ] **Step 6: Test properties**

Append to `backend/spring-boot/src/test/resources/application.properties`:

```properties

# Media uploads: local disk under target/ so tests never touch S3.
ceview.media.storage=local
ceview.media.local-dir=target/test-media
ceview.media.public-base-url=http://localhost:8080
```

- [ ] **Step 7: Ignore local uploads**

Append to the repo-root `.gitignore`:

```
# Local-dev media uploads (MEDIA_STORAGE=local)
backend/spring-boot/media-uploads/
```

- [ ] **Step 8: Verify the YAML and JSON parse**

Run:
```bash
cd /c/Users/austi/CeView
python -c "import json;json.load(open('deploy/aws/iam/media-user-policy.json'));json.load(open('deploy/aws/s3/media-bucket-cors.json'));print('json ok')"
python -c "import yaml;yaml.safe_load(open('backend/spring-boot/src/main/resources/application.yml'));yaml.safe_load(open('deploy/aws/docker-compose.prod.yml'));print('yaml ok')"
```
Expected: `json ok` then `yaml ok`. (If PyYAML is missing: `pip install pyyaml`.) Compose interpolation (`${...}`) is plain text to YAML, so this only checks structure.

- [ ] **Step 9: Checkpoint** — report the changed files to the user; they commit.

---

### Task 2: Setup guide and spec corrections

**Files:**
- Create: `docs/SOCIAL_PUBLISHING_SETUP.md`
- Modify: `AD_PLATFORM_SETUP.md` (add a pointer)
- Modify: `docs/superpowers/specs/2026-10-19-social-publishing-design.md`

- [ ] **Step 1: Write the setup guide**

`docs/SOCIAL_PUBLISHING_SETUP.md`:

````markdown
# Social publishing — platform and AWS setup

One-time setup for CVW-55 (connect Facebook / Instagram / TikTok, publish, Meta Ads handoff).
Design: `docs/superpowers/specs/2026-10-19-social-publishing-design.md`. Ad-account reporting
setup (the existing `ads_read` connection) stays in `AD_PLATFORM_SETUP.md`.

Everything here is free. Console labels change; if one differs, follow the intent.

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
- **Graph API version:** the code defaults to `v21.0`; bump `ceview.adplatform.meta.graph-base-url`
  (and the dialog URL) to a current version before App Review.
````

- [ ] **Step 2: Link it from the ad setup doc**

At the end of the first section of `AD_PLATFORM_SETUP.md` (right after the scope note that says it does not publish posts), add one line:

```markdown
> Publishing posts and creating ads is a separate connection: see `docs/SOCIAL_PUBLISHING_SETUP.md`.
```

- [ ] **Step 3: Correct the spec**

In `docs/superpowers/specs/2026-10-19-social-publishing-design.md`:

1. Under **Decisions**, append a bullet: `- Media uploads are signed with a dedicated least-privilege IAM user (`ceview-media`) rather than the server's `ceview-box` key; the media bucket also grants `s3:ListBucket` so a missing object is a 404, not a 403.`
2. Under **Risks and open items**, append: `- Instagram's publish API reportedly accepts JPEG only and TikTok photo posts JPEG/WEBP only; the composer accepts PNG/JPG/WEBP. Phase 3 publishers must validate or convert (verify against current docs).`

- [ ] **Step 4: Checkpoint** — report the changed files; the user commits.

---

# PHASE 1 — Media storage

## Backend

### Task 3: AWS SDK dependency

**Files:** Modify `backend/spring-boot/pom.xml`

- [ ] **Step 1: Add the BOM** — immediately before the `    <dependencies>` line (line 27) add:

```xml
    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>software.amazon.awssdk</groupId>
                <artifactId>bom</artifactId>
                <version>2.29.0</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

```

- [ ] **Step 2: Add the S3 module** — after the `firebase-admin` dependency block:

```xml
            <artifactId>firebase-admin</artifactId>
            <version>9.4.2</version>
        </dependency>
        <dependency>
            <groupId>software.amazon.awssdk</groupId>
            <artifactId>s3</artifactId>
        </dependency>
```

(Keep the existing `<dependency><groupId>…firebase…` opening lines; only add the new block after the closing `</dependency>`.)

- [ ] **Step 3: Verify it resolves and the project still compiles**

Run: `cd backend/spring-boot && ./mvnw -q -DskipTests compile`
Expected: build succeeds. If `2.29.0` does not resolve, use the newest 2.x BOM from Maven Central (`software.amazon.awssdk:bom`) and retry.

- [ ] **Step 4: Checkpoint.**

---

### Task 4: Migration, entity, repository and `MediaPolicy`

**Files:**
- Create: `…/db/migration/V48__module3_media_asset.sql`
- Create: `…/module3/media/{MediaPolicy,MediaAsset,MediaAssetRepository}.java`
- Test: `…/test/java/com/ceview/module3/media/MediaPolicyTest.java`

(`…` = `backend/spring-boot/src/main/resources` for SQL; `backend/spring-boot/src/main/java/com/ceview` / `…/src/test/java/com/ceview` for Java.)

- [ ] **Step 1: Write the failing test**

`MediaPolicyTest.java`:

```java
package com.ceview.module3.media;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaPolicyTest {

    @Test
    void acceptsJpegPngAndWebpAsImages() {
        for (String type : new String[] {"image/jpeg", "image/png", "image/webp"}) {
            assertThat(MediaPolicy.ruleFor(type)).hasValueSatisfying(rule -> {
                assertThat(rule.kind()).isEqualTo(MediaPolicy.KIND_IMAGE);
                assertThat(rule.maxBytes()).isEqualTo(MediaPolicy.MAX_IMAGE_BYTES);
            });
        }
    }

    @Test
    void acceptsMp4AndQuickTimeAsVideos() {
        assertThat(MediaPolicy.ruleFor("video/mp4")).hasValueSatisfying(rule -> {
            assertThat(rule.kind()).isEqualTo(MediaPolicy.KIND_VIDEO);
            assertThat(rule.extension()).isEqualTo("mp4");
        });
        assertThat(MediaPolicy.ruleFor("video/quicktime"))
                .hasValueSatisfying(rule -> assertThat(rule.extension()).isEqualTo("mov"));
    }

    @Test
    void rejectsAnythingElse() {
        assertThat(MediaPolicy.ruleFor("image/gif")).isEmpty();
        assertThat(MediaPolicy.ruleFor("application/pdf")).isEmpty();
        assertThat(MediaPolicy.ruleFor("")).isEmpty();
        assertThat(MediaPolicy.ruleFor(null)).isEmpty();
    }

    @Test
    void contentTypeLookupIgnoresCase() {
        assertThat(MediaPolicy.ruleFor("IMAGE/JPEG")).isPresent();
    }

    @Test
    void videosMayBeLargerThanImages() {
        assertThat(MediaPolicy.MAX_VIDEO_BYTES).isGreaterThan(MediaPolicy.MAX_IMAGE_BYTES);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaPolicyTest`
Expected: compilation FAILURE — `MediaPolicy` does not exist.

- [ ] **Step 3: Implement `MediaPolicy`**

`module3/media/MediaPolicy.java`:

```java
package com.ceview.module3.media;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * What CeView accepts for upload.
 *
 * <p>The 8 MB image cap is Instagram's limit, the strictest of the three
 * platforms. The 250 MB video cap keeps a single presigned PUT workable and fits
 * short-form video on all three platforms.
 */
public final class MediaPolicy {

    public static final String KIND_IMAGE = "image";
    public static final String KIND_VIDEO = "video";

    public static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;
    public static final long MAX_VIDEO_BYTES = 250L * 1024 * 1024;

    /** What to do with one accepted content type. */
    public record Rule(String kind, String extension, long maxBytes) {}

    private static final Map<String, Rule> RULES = Map.of(
            "image/jpeg", new Rule(KIND_IMAGE, "jpg", MAX_IMAGE_BYTES),
            "image/png", new Rule(KIND_IMAGE, "png", MAX_IMAGE_BYTES),
            "image/webp", new Rule(KIND_IMAGE, "webp", MAX_IMAGE_BYTES),
            "video/mp4", new Rule(KIND_VIDEO, "mp4", MAX_VIDEO_BYTES),
            "video/quicktime", new Rule(KIND_VIDEO, "mov", MAX_VIDEO_BYTES));

    private MediaPolicy() {}

    public static Optional<Rule> ruleFor(String contentType) {
        if (contentType == null) return Optional.empty();
        return Optional.ofNullable(RULES.get(contentType.trim().toLowerCase(Locale.ROOT)));
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaPolicyTest`
Expected: 5 tests pass.

- [ ] **Step 5: Add the migration**

`src/main/resources/db/migration/V48__module3_media_asset.sql`:

```sql
-- ============================================================================
-- V48 — Module 3: uploaded media (images and videos) for publishing
--
-- WHY
--   Social platforms fetch media from a public HTTPS URL; today media exists only
--   as a base64 data URL in the browser. A row here tracks one uploaded file:
--   PENDING until the browser has PUT it to storage and the API has verified it,
--   then READY.
--
-- The file itself lives in S3 (served via CloudFront under /media/*) or, in local
-- dev, on disk. storage_key is the object key; public_url is what platforms fetch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_media_asset (
    media_id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID         NOT NULL,
    kind                VARCHAR(10)  NOT NULL,
    content_type        VARCHAR(50)  NOT NULL,
    -- Declared at request time, replaced by the real stored size on completion.
    size_bytes          BIGINT       NOT NULL,
    storage_key         VARCHAR(255) NOT NULL,
    public_url          VARCHAR(512) NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    width               INTEGER,
    height              INTEGER,
    duration_seconds    INTEGER,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT pk_media_asset PRIMARY KEY (media_id),
    CONSTRAINT fk_media_asset_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_media_asset_key UNIQUE (storage_key),
    CONSTRAINT chk_media_asset_kind CHECK (kind IN ('image', 'video')),
    CONSTRAINT chk_media_asset_status CHECK (status IN ('PENDING', 'READY'))
);

COMMENT ON TABLE tbl_media_asset IS
    'One uploaded image/video. PENDING until stored and verified, then READY.';

CREATE INDEX IF NOT EXISTS idx_media_asset_profile
    ON tbl_media_asset (business_profile_id, created_at DESC);
```

- [ ] **Step 6: Add the entity**

`module3/media/MediaAsset.java`:

```java
package com.ceview.module3.media;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One uploaded image or video (V48). */
@Data
@Entity
@Table(name = "tbl_media_asset")
public class MediaAsset {

    /** Match the CHECK constraint in V48. */
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_READY = "READY";

    @Id
    @Column(name = "media_id")
    private UUID mediaId;

    @Column(name = "business_profile_id", nullable = false) private UUID businessProfileId;
    @Column(name = "kind", nullable = false, length = 10) private String kind;
    @Column(name = "content_type", nullable = false, length = 50) private String contentType;
    @Column(name = "size_bytes", nullable = false) private long sizeBytes;
    @Column(name = "storage_key", nullable = false, length = 255) private String storageKey;
    @Column(name = "public_url", nullable = false, length = 512) private String publicUrl;
    @Column(name = "status", nullable = false, length = 20) private String status;

    @Column(name = "width") private Integer width;
    @Column(name = "height") private Integer height;
    @Column(name = "duration_seconds") private Integer durationSeconds;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (mediaId == null) mediaId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = STATUS_PENDING;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 7: Add the repository**

`module3/media/MediaAssetRepository.java`:

```java
package com.ceview.module3.media;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Tenant-scoped lookups only: there is deliberately no way to fetch an asset by
 * id alone for an authenticated caller. (The dev-only local upload endpoint reads
 * by id because the unguessable id is its credential.)
 */
public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    Optional<MediaAsset> findByMediaIdAndBusinessProfileId(UUID mediaId, UUID businessProfileId);
}
```

- [ ] **Step 8: Compile**

Run: `cd backend/spring-boot && ./mvnw -q -DskipTests compile`
Expected: success.

- [ ] **Step 9: Checkpoint.**

---

### Task 5: `MediaStorage` and `LocalMediaStorage`

**Files:**
- Create: `module3/media/{MediaStorage,LocalMediaStorage}.java`
- Test: `…/test/…/module3/media/LocalMediaStorageTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module3.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalMediaStorageTest {

    @TempDir Path dir;

    @Test
    void writesAFileAndReportsItsSize() throws Exception {
        LocalMediaStorage storage = new LocalMediaStorage(dir);
        long written = storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[]{1, 2, 3}), 10);

        assertThat(written).isEqualTo(3);
        assertThat(storage.sizeOf("media/p1/a.jpg")).hasValue(3);
    }

    @Test
    void reportsAMissingFileAsEmpty() {
        assertThat(new LocalMediaStorage(dir).sizeOf("media/p1/none.jpg")).isEmpty();
    }

    @Test
    void refusesAnOversizeUploadAndLeavesNothingBehind() {
        LocalMediaStorage storage = new LocalMediaStorage(dir);

        assertThatThrownBy(() ->
                storage.write("media/p1/big.jpg", new ByteArrayInputStream(new byte[100]), 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(storage.sizeOf("media/p1/big.jpg")).isEmpty();
    }

    @Test
    void deleteRemovesTheFile() throws Exception {
        LocalMediaStorage storage = new LocalMediaStorage(dir);
        storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[]{1}), 10);

        storage.delete("media/p1/a.jpg");

        assertThat(storage.sizeOf("media/p1/a.jpg")).isEmpty();
    }

    @Test
    void refusesAKeyThatEscapesTheRoot() {
        LocalMediaStorage storage = new LocalMediaStorage(dir);

        assertThatThrownBy(() ->
                storage.write("../outside.jpg", new ByteArrayInputStream(new byte[]{1}), 10))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void uploadUrlPointsAtTheLocalEndpoint() {
        UUID id = UUID.randomUUID();
        assertThat(new LocalMediaStorage(dir).uploadUrl(id, "media/p1/a.jpg", "image/jpeg"))
                .isEqualTo("/api/media/local/" + id);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=LocalMediaStorageTest`
Expected: compilation FAILURE — classes do not exist.

- [ ] **Step 3: Implement the interface**

`module3/media/MediaStorage.java`:

```java
package com.ceview.module3.media;

import java.util.OptionalLong;
import java.util.UUID;

/** Where uploaded media bytes live. Keys are server-generated, never client input. */
public interface MediaStorage {

    /**
     * The URL the browser PUTs the file to, with the given Content-Type header.
     * May be absolute (S3 presigned) or relative to the API origin (local dev).
     */
    String uploadUrl(UUID mediaId, String key, String contentType);

    /** Stored size in bytes, or empty if nothing has been uploaded under this key. */
    OptionalLong sizeOf(String key);

    void delete(String key);
}
```

- [ ] **Step 4: Implement `LocalMediaStorage`**

```java
package com.ceview.module3.media;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Disk-backed storage for local development and tests. Files are served back by
 * {@link LocalMediaWebConfig} under {@code /media/**}, so the key layout
 * ({@code media/<profile>/<id>.<ext>}) doubles as the URL path.
 */
public class LocalMediaStorage implements MediaStorage {

    private final Path root;

    public LocalMediaStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType) {
        return "/api/media/local/" + mediaId;
    }

    /**
     * Streams {@code in} to disk, giving up as soon as it exceeds {@code maxBytes}
     * so a bad client cannot fill the disk.
     *
     * @return bytes written
     * @throws IllegalArgumentException if the key escapes the root or the stream is too large
     */
    public long write(String key, InputStream in, long maxBytes) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        long total = 0;
        try (OutputStream out = Files.newOutputStream(target,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new IllegalArgumentException("upload exceeds " + maxBytes + " bytes");
                }
                out.write(buffer, 0, read);
            }
        } catch (IllegalArgumentException | IOException e) {
            Files.deleteIfExists(target);
            throw e;
        }
        return total;
    }

    @Override
    public OptionalLong sizeOf(String key) {
        try {
            Path file = resolve(key);
            return Files.isRegularFile(file) ? OptionalLong.of(Files.size(file)) : OptionalLong.empty();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private Path resolve(String key) {
        Path resolved = root.resolve(key).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("storage key escapes the media root");
        }
        return resolved;
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=LocalMediaStorageTest`
Expected: 6 tests pass.

- [ ] **Step 6: Checkpoint.**

---

### Task 6: `S3MediaStorage` and `UnconfiguredMediaStorage`

**Files:**
- Create: `module3/media/{S3MediaStorage,UnconfiguredMediaStorage}.java`
- Test: `…/test/…/module3/media/S3MediaStorageTest.java`

- [ ] **Step 1: Write the failing test** (presigning is computed offline, so no AWS access is needed)

```java
package com.ceview.module3.media;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class S3MediaStorageTest {

    @Test
    void presignsAPutForTheKeyWithTheContentTypeSigned() {
        S3MediaStorage storage = new S3MediaStorage(
                "test-bucket", "ap-southeast-1", "AKIATESTKEY", "test-secret", Duration.ofMinutes(10));

        String url = storage.uploadUrl(UUID.randomUUID(), "media/p1/a.jpg", "image/jpeg");

        assertThat(url)
                .startsWith("https://test-bucket.s3.ap-southeast-1.amazonaws.com/media/p1/a.jpg?")
                .contains("X-Amz-Signature=")
                .contains("X-Amz-Expires=600")
                // content-type is a signed header, so the browser must send exactly the type we asked for
                .contains("content-type");
        storage.close();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=S3MediaStorageTest`
Expected: compilation FAILURE — `S3MediaStorage` does not exist.

- [ ] **Step 3: Implement `S3MediaStorage`**

```java
package com.ceview.module3.media;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.time.Duration;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Production storage. The browser PUTs straight to S3 with a short-lived presigned
 * URL, so large videos never pass through the API server.
 *
 * <p>Needs {@code s3:PutObject/GetObject/DeleteObject} on {@code media/*} and
 * {@code s3:ListBucket} on the bucket (without ListBucket S3 answers a HEAD on a
 * missing key with 403, not 404) — see deploy/aws/iam/media-user-policy.json.
 */
public class S3MediaStorage implements MediaStorage, AutoCloseable {

    private final S3Presigner presigner;
    private final S3Client s3;
    private final String bucket;
    private final Duration presignTtl;

    public S3MediaStorage(String bucket, String region, String accessKeyId,
                          String secretAccessKey, Duration presignTtl) {
        AwsCredentialsProvider credentials = (accessKeyId == null || accessKeyId.isBlank())
                ? DefaultCredentialsProvider.create()
                : StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        Region awsRegion = Region.of(region);
        this.bucket = bucket;
        this.presignTtl = presignTtl;
        this.presigner = S3Presigner.builder().region(awsRegion).credentialsProvider(credentials).build();
        this.s3 = S3Client.builder().region(awsRegion).credentialsProvider(credentials).build();
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(bucket).key(key).contentType(contentType).build();
        return presigner
                .presignPutObject(r -> r.signatureDuration(presignTtl).putObjectRequest(put))
                .url().toString();
    }

    @Override
    public OptionalLong sizeOf(String key) {
        try {
            return OptionalLong.of(s3.headObject(r -> r.bucket(bucket).key(key)).contentLength());
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return OptionalLong.empty();
            throw e;
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(r -> r.bucket(bucket).key(key));
    }

    @Override
    public void close() {
        presigner.close();
        s3.close();
    }
}
```

- [ ] **Step 4: Implement `UnconfiguredMediaStorage`**

```java
package com.ceview.module3.media;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.OptionalLong;
import java.util.UUID;

/**
 * Stands in when {@code ceview.media.storage=s3} but no bucket is configured, so
 * the app still boots and the media endpoints say why they are off — the same
 * degrade-gracefully posture as the token cipher.
 */
public class UnconfiguredMediaStorage implements MediaStorage {

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "media storage is not configured (set MEDIA_BUCKET)");
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType) {
        throw unavailable();
    }

    @Override
    public OptionalLong sizeOf(String key) {
        throw unavailable();
    }

    @Override
    public void delete(String key) {
        throw unavailable();
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=S3MediaStorageTest`
Expected: 1 test passes. If the URL is path-style (`s3.ap-southeast-1.amazonaws.com/test-bucket/...`), adjust the `startsWith` expectation to what the SDK emits — virtual-hosted style is the default for DNS-safe bucket names.

- [ ] **Step 6: Checkpoint.**

---

### Task 7: Storage wiring (`MediaConfig`, `LocalMediaWebConfig`)

**Files:**
- Create: `module3/media/{MediaConfig,LocalMediaWebConfig}.java`
- Test: `…/test/…/module3/media/MediaConfigTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module3.media;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaConfigTest {

    @Test
    void s3WithoutABucketStillBootsButRefusesToWork() {
        MediaStorage storage = new MediaConfig()
                .s3MediaStorage("", "ap-southeast-1", "", "", 15);

        assertThat(storage).isInstanceOf(UnconfiguredMediaStorage.class);
        assertThatThrownBy(() -> storage.uploadUrl(UUID.randomUUID(), "media/x.jpg", "image/jpeg"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not configured");
    }

    @Test
    void s3WithABucketBuildsTheRealStorage() {
        MediaStorage storage = new MediaConfig()
                .s3MediaStorage("some-bucket", "ap-southeast-1", "AKIATESTKEY", "secret", 15);

        assertThat(storage).isInstanceOf(S3MediaStorage.class);
        ((S3MediaStorage) storage).close();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaConfigTest`
Expected: compilation FAILURE — `MediaConfig` does not exist.

- [ ] **Step 3: Implement `MediaConfig`**

```java
package com.ceview.module3.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;
import java.time.Duration;

/** Picks exactly one {@link MediaStorage} from {@code ceview.media.storage}. */
@Configuration
public class MediaConfig {

    @Bean
    @ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
    public LocalMediaStorage localMediaStorage(
            @Value("${ceview.media.local-dir:./media-uploads}") String dir) {
        return new LocalMediaStorage(Path.of(dir));
    }

    @Bean
    @ConditionalOnProperty(name = "ceview.media.storage", havingValue = "s3")
    public MediaStorage s3MediaStorage(
            @Value("${ceview.media.s3.bucket:}") String bucket,
            @Value("${ceview.media.s3.region:ap-southeast-1}") String region,
            @Value("${ceview.media.s3.access-key-id:}") String accessKeyId,
            @Value("${ceview.media.s3.secret-access-key:}") String secretAccessKey,
            @Value("${ceview.media.s3.presign-minutes:15}") long presignMinutes) {
        if (bucket == null || bucket.isBlank()) {
            return new UnconfiguredMediaStorage();
        }
        return new S3MediaStorage(bucket, region, accessKeyId, secretAccessKey,
                Duration.ofMinutes(presignMinutes));
    }
}
```

- [ ] **Step 4: Implement `LocalMediaWebConfig`** (serves local uploads back at `/media/**`)

```java
package com.ceview.module3.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

/**
 * Local-dev only: exposes the upload directory at {@code /media/**}, mirroring
 * what CloudFront does in production. Keys are laid out as {@code media/<profile>/<id>.<ext>};
 * Spring resolves only the part of the URL after {@code /media/}, so the resource location
 * is the {@code media/} subdirectory of the storage root.
 */
@Configuration
@ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
public class LocalMediaWebConfig implements WebMvcConfigurer {

    private final String location;

    public LocalMediaWebConfig(@Value("${ceview.media.local-dir:./media-uploads}") String dir) {
        String uri = Path.of(dir).toAbsolutePath().normalize().toUri().toString();
        // toUri() only adds the trailing slash when the directory already exists.
        this.location = (uri.endsWith("/") ? uri : uri + "/") + "media/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/**").addResourceLocations(location);
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaConfigTest`
Expected: 2 tests pass.

- [ ] **Step 6: Checkpoint.**

---

### Task 8: `MediaService`, DTOs and `MediaController`

**Files:**
- Create: `module3/media/{MediaDtos,MediaService,MediaController}.java`
- Test: `…/test/…/module3/media/MediaControllerTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module3.media;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.testsupport.TestOperators;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayInputStream;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class MediaControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private MediaAssetRepository mediaRepo;
    @Autowired private MediaService mediaService;
    @Autowired private LocalMediaStorage storage;
    @Autowired private TestOperators testOperators;

    private record Tenant(String token, UUID profileId) {}

    private Tenant a;
    private Tenant b;

    @BeforeEach
    void setUp() {
        mediaRepo.deleteAll();
        profileRepo.deleteAll();
        a = tenant("Cebu Dive Co.");
        b = tenant("Mactan Cafe");
    }

    private Tenant tenant(String businessName) {
        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName(businessName);
        UUID profileId = profileRepo.save(profile).getBusinessProfileId();
        return new Tenant(jwtService.issue(operatorId, operatorId + "@example.com"), profileId);
    }

    private static String bearer(Tenant t) {
        return "Bearer " + t.token();
    }

    private static String uploadBody(String contentType, long sizeBytes) {
        return "{\"contentType\":\"" + contentType + "\",\"sizeBytes\":" + sizeBytes + "}";
    }

    @Test
    void issuesAnUploadSlotScopedToTheTenant() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 1024)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("image"))
                .andExpect(jsonPath("$.uploadUrl").value(startsWith("/api/media/local/")))
                .andExpect(jsonPath("$.publicUrl")
                        .value(startsWith("http://localhost:8080/media/" + a.profileId() + "/")));

        assertThat(mediaRepo.findAll()).singleElement().satisfies(asset -> {
            assertThat(asset.getBusinessProfileId()).isEqualTo(a.profileId());
            assertThat(asset.getStatus()).isEqualTo(MediaAsset.STATUS_PENDING);
        });
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(post("/api/media/uploads")
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 1024)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAnUnsupportedType() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("application/pdf", 1024)))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void rejectsAnImageOverTheLimit() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(uploadBody("image/png", MediaPolicy.MAX_IMAGE_BYTES + 1)))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void acceptsALargeVideo() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(uploadBody("video/mp4", MediaPolicy.MAX_IMAGE_BYTES + 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("video"));
    }

    @Test
    void rejectsAnEmptyFile() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 0)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void completeBeforeTheFileIsStoredIsAConflict() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void completeMarksTheAssetReadyWithTheRealSizeAndDimensions() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"width\":800,\"height\":600}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.sizeBytes").value(4))
                .andExpect(jsonPath("$.width").value(800))
                .andExpect(jsonPath("$.height").value(600))
                .andExpect(jsonPath("$.publicUrl").value(asset.getPublicUrl()));
    }

    @Test
    void completeWithoutABodyStillWorks() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/png", 2);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void completeRejectsAndDeletesAFileLargerThanThePolicyAllows() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(),
                new ByteArrayInputStream(new byte[(int) MediaPolicy.MAX_IMAGE_BYTES + 1]), Long.MAX_VALUE);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isPayloadTooLarge());

        assertThat(storage.sizeOf(asset.getStorageKey())).isEmpty();
        assertThat(mediaRepo.findById(asset.getMediaId())).isEmpty();
    }

    @Test
    void anotherTenantCannotCompleteMyUpload() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaControllerTest`
Expected: compilation FAILURE — `MediaService` does not exist.

- [ ] **Step 3: Implement the DTOs**

`module3/media/MediaDtos.java`:

```java
package com.ceview.module3.media;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

public final class MediaDtos {

    private MediaDtos() {}

    public record UploadRequest(@NotBlank String contentType, @Positive long sizeBytes) {}

    /**
     * {@code uploadUrl} may be relative to the API origin (local dev); the browser
     * must PUT the file to it with the same Content-Type it declared.
     */
    public record UploadResponse(UUID mediaId, String uploadUrl, String publicUrl, String kind) {}

    public record CompleteRequest(@Min(1) Integer width, @Min(1) Integer height,
                                  @Min(0) Integer durationSeconds) {}

    public record MediaResponse(UUID mediaId, String kind, String contentType, long sizeBytes,
                                String publicUrl, String status,
                                Integer width, Integer height, Integer durationSeconds) {

        static MediaResponse from(MediaAsset a) {
            return new MediaResponse(a.getMediaId(), a.getKind(), a.getContentType(), a.getSizeBytes(),
                    a.getPublicUrl(), a.getStatus(), a.getWidth(), a.getHeight(), a.getDurationSeconds());
        }
    }
}
```

- [ ] **Step 4: Implement `MediaService`**

```java
package com.ceview.module3.media;

import com.ceview.module3.media.MediaPolicy.Rule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

/** Owns the upload lifecycle: validate, mint a key, verify the stored object. */
@Service
public class MediaService {

    private final MediaAssetRepository repo;
    private final MediaStorage storage;
    private final String publicBaseUrl;

    public MediaService(MediaAssetRepository repo, MediaStorage storage,
                        @Value("${ceview.media.public-base-url:http://localhost:8080}") String publicBaseUrl) {
        this.repo = repo;
        this.storage = storage;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    /** Validates the declared type/size and records a PENDING asset with a server-generated key. */
    @Transactional
    public MediaAsset requestUpload(UUID businessProfileId, String contentType, long sizeBytes) {
        Rule rule = MediaPolicy.ruleFor(contentType).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "unsupported media type: " + contentType));
        if (sizeBytes <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is empty");
        }
        if (sizeBytes > rule.maxBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "file exceeds the " + (rule.maxBytes() / (1024 * 1024)) + " MB limit for " + rule.kind() + "s");
        }

        UUID mediaId = UUID.randomUUID();
        String key = "media/" + businessProfileId + "/" + mediaId + "." + rule.extension();

        MediaAsset asset = new MediaAsset();
        asset.setMediaId(mediaId);
        asset.setBusinessProfileId(businessProfileId);
        asset.setKind(rule.kind());
        asset.setContentType(contentType.trim().toLowerCase(Locale.ROOT));
        asset.setSizeBytes(sizeBytes);
        asset.setStorageKey(key);
        asset.setPublicUrl(publicBaseUrl + "/" + key);
        asset.setStatus(MediaAsset.STATUS_PENDING);
        return repo.save(asset);
    }

    /**
     * Confirms the file really is in storage and within policy, then marks the asset READY.
     * Idempotent for an already-READY asset. {@code noRollbackFor} so that deleting an
     * oversize upload sticks when the 413 is thrown.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public MediaAsset complete(UUID businessProfileId, UUID mediaId,
                               Integer width, Integer height, Integer durationSeconds) {
        MediaAsset asset = repo.findByMediaIdAndBusinessProfileId(mediaId, businessProfileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "media not found"));
        if (MediaAsset.STATUS_READY.equals(asset.getStatus())) {
            return asset;
        }

        long actual = storage.sizeOf(asset.getStorageKey()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT,
                        "the file has not been uploaded yet — PUT it to the upload URL first"));

        Rule rule = MediaPolicy.ruleFor(asset.getContentType()).orElseThrow();
        if (actual > rule.maxBytes()) {
            storage.delete(asset.getStorageKey());
            repo.delete(asset);
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "the uploaded file exceeds the allowed size and was discarded");
        }

        asset.setSizeBytes(actual);
        asset.setWidth(width);
        asset.setHeight(height);
        asset.setDurationSeconds(durationSeconds);
        asset.setStatus(MediaAsset.STATUS_READY);
        return repo.save(asset);
    }
}
```

(`ruleFor` succeeded above, so `contentType` is non-null at the `setContentType` line. The normalised, lower-cased value is what the PUT's Content-Type header must match.)

- [ ] **Step 5: Implement `MediaController`**

```java
package com.ceview.module3.media;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.media.MediaDtos.CompleteRequest;
import com.ceview.module3.media.MediaDtos.MediaResponse;
import com.ceview.module3.media.MediaDtos.UploadRequest;
import com.ceview.module3.media.MediaDtos.UploadResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Tenant-scoped media upload API. Every call resolves the profile from the JWT. */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final CurrentBusinessProfile currentBusinessProfile;
    private final MediaService service;
    private final MediaStorage storage;

    public MediaController(CurrentBusinessProfile currentBusinessProfile,
                           MediaService service, MediaStorage storage) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.service = service;
        this.storage = storage;
    }

    @PostMapping("/uploads")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse requestUpload(@Valid @RequestBody UploadRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        MediaAsset asset = service.requestUpload(profileId, body.contentType(), body.sizeBytes());
        return new UploadResponse(asset.getMediaId(),
                storage.uploadUrl(asset.getMediaId(), asset.getStorageKey(), asset.getContentType()),
                asset.getPublicUrl(), asset.getKind());
    }

    @PostMapping("/{mediaId}/complete")
    public MediaResponse complete(@PathVariable UUID mediaId,
                                  @Valid @RequestBody(required = false) CompleteRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        CompleteRequest dims = body != null ? body : new CompleteRequest(null, null, null);
        return MediaResponse.from(service.complete(profileId, mediaId,
                dims.width(), dims.height(), dims.durationSeconds()));
    }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=MediaControllerTest`
Expected: 11 tests pass. If `requiresAuthentication` returns 403 instead of 401, check how `SecurityConfig` builds its entry point (L81-88) — the AdConnection tests assert the same behavior.

- [ ] **Step 7: Checkpoint.**

---

### Task 9: Local-dev upload endpoint and security wiring

**Files:**
- Create: `module3/media/LocalMediaUploadController.java`
- Modify: `config/SecurityConfig.java`
- Modify: `auth/ProfileCompletionFilter.java` (`isExempt`, ~L106)
- Test: `…/test/…/module3/media/LocalMediaUploadTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module3.media;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The dev-only upload target: no JWT, the unguessable media id is the credential. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class LocalMediaUploadTest {

    @Autowired private MockMvc mvc;
    @Autowired private MediaService mediaService;
    @Autowired private MediaAssetRepository mediaRepo;
    @Autowired private LocalMediaStorage storage;

    private static final byte[] PNG_BYTES = {(byte) 0x89, 'P', 'N', 'G'};

    @BeforeEach
    void setUp() {
        mediaRepo.deleteAll();
    }

    private MediaAsset pendingPng() {
        return mediaService.requestUpload(UUID.randomUUID(), "image/png", PNG_BYTES.length);
    }

    @Test
    void storesTheBytesWithoutAJwt() throws Exception {
        MediaAsset asset = pendingPng();

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNoContent());

        assertThat(storage.sizeOf(asset.getStorageKey())).hasValue(PNG_BYTES.length);
    }

    @Test
    void servesTheStoredFileAtItsPublicPath() throws Exception {
        MediaAsset asset = pendingPng();
        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                .contentType("image/png").content(PNG_BYTES)).andExpect(status().isNoContent());

        mvc.perform(get("/" + asset.getStorageKey()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(PNG_BYTES));
    }

    @Test
    void rejectsAContentTypeThatDiffersFromTheDeclaredOne() throws Exception {
        MediaAsset asset = pendingPng();

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/jpeg").content(PNG_BYTES))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void rejectsAnUnknownMediaId() throws Exception {
        mvc.perform(put("/api/media/local/" + UUID.randomUUID())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }

    @Test
    void refusesToOverwriteAnAssetAlreadyMarkedReady() throws Exception {
        MediaAsset asset = pendingPng();
        asset.setStatus(MediaAsset.STATUS_READY);
        mediaRepo.save(asset);

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest=LocalMediaUploadTest`
Expected: tests FAIL (404 for the PUT route / 401 for `/media/**`) — the controller and permits do not exist yet.

- [ ] **Step 3: Implement the controller**

`module3/media/LocalMediaUploadController.java`:

```java
package com.ceview.module3.media;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.UUID;

/**
 * Local-dev stand-in for an S3 presigned PUT. Like a presigned URL it carries no
 * JWT: the unguessable media id is the credential, and it only accepts a PENDING
 * asset, so a completed upload cannot be overwritten. Not registered when
 * {@code ceview.media.storage=s3}.
 */
@RestController
@ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
public class LocalMediaUploadController {

    private final MediaAssetRepository repo;
    private final LocalMediaStorage storage;

    public LocalMediaUploadController(MediaAssetRepository repo, LocalMediaStorage storage) {
        this.repo = repo;
        this.storage = storage;
    }

    @PutMapping("/api/media/local/{mediaId}")
    public ResponseEntity<Void> upload(@PathVariable UUID mediaId, HttpServletRequest request)
            throws IOException {
        MediaAsset asset = repo.findById(mediaId)
                .filter(a -> MediaAsset.STATUS_PENDING.equals(a.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no pending upload"));

        String sent = request.getContentType() == null ? "" : request.getContentType().split(";")[0].trim();
        if (!sent.equalsIgnoreCase(asset.getContentType())) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "expected Content-Type " + asset.getContentType());
        }

        long max = MediaPolicy.ruleFor(asset.getContentType()).orElseThrow().maxBytes();
        try {
            storage.write(asset.getStorageKey(), request.getInputStream(), max);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: Permit the two routes in `SecurityConfig`**

In `config/SecurityConfig.java`, directly after the line `.requestMatchers("/api/ad-connections/*/callback").permitAll()` add:

```java
                // Local-dev media (ceview.media.storage=local): the browser PUTs to a one-time
                // URL named by an unguessable media id, as with a presigned S3 URL, and reads
                // uploads back from /media/**. In production CloudFront serves /media/* from
                // S3 and neither route is reachable on the API.
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/media/local/*").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/media/**").permitAll()
```

- [ ] **Step 5: Exempt them from the profile/email gates**

In `auth/ProfileCompletionFilter.java` `isExempt`, extend the final clauses so the method ends:

```java
            || path.startsWith("/r/")
            || path.startsWith("/api/public/attribution/")
            // Local-dev media upload/readback (see SecurityConfig): no operator is behind these.
            || path.startsWith("/media/")
            || path.matches("^/api/media/local/[^/]+$");
```

(This replaces the existing `|| path.startsWith("/api/public/attribution/");` ending — keep the comment above it.)

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend/spring-boot && ./mvnw -q test -Dtest="LocalMediaUploadTest,MediaControllerTest"`
Expected: 16 tests pass (5 + 11).

- [ ] **Step 7: Run the whole backend suite**

Run: `cd backend/spring-boot && ./mvnw -q test`
Expected: all tests pass; nothing regressed (the AWS SDK and new beans load in every `@SpringBootTest`). If a failure is clearly unrelated and was already failing on this branch, report it rather than fixing it.

- [ ] **Step 8: Checkpoint.**

---

## Frontend

### Task 10: Types, API client and the upload helper

**Files:**
- Modify: `frontend/types.ts` (append)
- Modify: `frontend/services/apiClient.ts`
- Create: `frontend/services/mediaUpload.ts`
- Test: `frontend/services/mediaUpload.test.ts`

- [ ] **Step 1: Append the DTO types**

Append to the end of `frontend/types.ts`:

```ts

/** POST /api/media/uploads — where to PUT the file, and the public URL it will have. */
export interface MediaUploadSlot {
  mediaId: string;
  /** Absolute (S3), relative to the API origin (local dev), or starting with '#' in fixture mode. */
  uploadUrl: string;
  publicUrl: string;
  kind: 'image' | 'video';
}

/** POST /api/media/{id}/complete */
export interface MediaAssetDto {
  mediaId: string;
  kind: 'image' | 'video';
  contentType: string;
  sizeBytes: number;
  publicUrl: string;
  status: 'PENDING' | 'READY';
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}
```

- [ ] **Step 2: Write the failing test**

`frontend/services/mediaUpload.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestUpload = vi.fn();
const complete = vi.fn();
vi.mock('./apiClient', () => ({
  API_BASE_URL: 'http://api.test',
  apiClient: { media: { requestUpload: (...a: unknown[]) => requestUpload(...a), complete: (...a: unknown[]) => complete(...a) } },
}));

import { MEDIA_LIMITS, mediaKindOf, uploadMedia } from './mediaUpload';

const fetchMock = vi.fn();

beforeEach(() => {
  requestUpload.mockReset();
  complete.mockReset().mockResolvedValue({});
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const jpeg = () => new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' });

describe('mediaKindOf', () => {
  it('classifies the accepted types', () => {
    expect(mediaKindOf('image/png')).toBe('image');
    expect(mediaKindOf('image/jpeg')).toBe('image');
    expect(mediaKindOf('image/webp')).toBe('image');
    expect(mediaKindOf('video/mp4')).toBe('video');
    expect(mediaKindOf('video/quicktime')).toBe('video');
  });

  it('rejects everything else', () => {
    expect(mediaKindOf('image/gif')).toBeNull();
    expect(mediaKindOf('')).toBeNull();
  });

  it('mirrors the backend limits', () => {
    expect(MEDIA_LIMITS.image).toBe(8 * 1024 * 1024);
    expect(MEDIA_LIMITS.video).toBe(250 * 1024 * 1024);
  });
});

describe('uploadMedia', () => {
  it('PUTs to an absolute (S3) URL without an Authorization header, then completes', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm1', uploadUrl: 'https://s3.example/obj?sig=1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });

    const result = await uploadMedia(jpeg(), { width: 800, height: 600 });

    expect(requestUpload).toHaveBeenCalledWith('image/jpeg', 3);
    expect(fetchMock).toHaveBeenCalledWith('https://s3.example/obj?sig=1',
      expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }));
    expect(complete).toHaveBeenCalledWith('m1', { width: 800, height: 600 });
    expect(result).toEqual({ mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });
  });

  it('resolves a relative (local dev) upload URL against the API origin', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm2', uploadUrl: '/api/media/local/m2', publicUrl: 'http://localhost:8080/media/x.jpg', kind: 'image' });

    await uploadMedia(jpeg());

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/media/local/m2');
  });

  it('skips the PUT in fixture mode', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'fx', uploadUrl: '#fixture-no-upload', publicUrl: 'https://example.invalid/fx', kind: 'image' });

    const result = await uploadMedia(jpeg());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mediaId).toBe('fx');
  });

  it('fails clearly when storage rejects the PUT, without completing', async () => {
    requestUpload.mockResolvedValue({ mediaId: 'm3', uploadUrl: 'https://s3.example/obj', publicUrl: 'u', kind: 'image' });
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(uploadMedia(jpeg())).rejects.toThrow(/403/);
    expect(complete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && npx vitest run services/mediaUpload.test.ts`
Expected: FAIL — cannot resolve `./mediaUpload`.

- [ ] **Step 4: Export the API base and add the `media` client**

In `frontend/services/apiClient.ts`:

1. Directly after the line `const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';` add:
   ```ts
   /** The API origin, for the few callers (media upload) that must build absolute URLs themselves. */
   export const API_BASE_URL = BASE_URL;
   ```
2. In the `import type { … } from '../types';` list, add `MediaUploadSlot,` and `MediaAssetDto,` before the closing `} from '../types';` (next to `UnconvertedClick,`).
3. Insert this block immediately before the comment `  /**\n   * Ad-platform (Meta / TikTok) account connections and metric sync.`:

```ts
  /** Media uploads for publishing — see services/mediaUpload.ts for the full flow. */
  media: {
    requestUpload: (contentType: string, sizeBytes: number) =>
      USE_FIXTURES
        ? delay<MediaUploadSlot>({
            mediaId: 'fixture-media',
            uploadUrl: '#fixture-no-upload',
            publicUrl: 'https://example.invalid/fixture-media',
            kind: contentType.startsWith('video/') ? 'video' : 'image',
          })
        : request<MediaUploadSlot>('/api/media/uploads', {
            method: 'POST',
            body: JSON.stringify({ contentType, sizeBytes }),
          }),

    complete: (mediaId: string, dims: { width?: number; height?: number; durationSeconds?: number } = {}) =>
      USE_FIXTURES
        ? delay<MediaAssetDto | null>(null)
        : request<MediaAssetDto>(`/api/media/${mediaId}/complete`, {
            method: 'POST',
            body: JSON.stringify(dims),
          }),
  },

```

- [ ] **Step 5: Implement the helper**

`frontend/services/mediaUpload.ts`:

```ts
/**
 * Browser side of the media upload: ask the API for a slot, PUT the file to
 * storage, then tell the API it is there. Mirrors MediaPolicy on the backend.
 */
import { API_BASE_URL, apiClient } from './apiClient';

export type MediaKind = 'image' | 'video';

/** Bytes. Keep in step with MediaPolicy.java. */
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024,
  video: 250 * 1024 * 1024,
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export function mediaKindOf(contentType: string): MediaKind | null {
  if (IMAGE_TYPES.has(contentType)) return 'image';
  if (VIDEO_TYPES.has(contentType)) return 'video';
  return null;
}

export interface MediaDimensions {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface UploadedMedia {
  mediaId: string;
  publicUrl: string;
  kind: MediaKind;
}

/**
 * Uploads `file` and resolves once the API has verified it is stored.
 * No Authorization header on the PUT: an S3 presigned URL is signed already
 * (extra headers would break it) and the local-dev endpoint is keyed by media id.
 */
export async function uploadMedia(file: File, dims: MediaDimensions = {}): Promise<UploadedMedia> {
  const slot = await apiClient.media.requestUpload(file.type, file.size);

  // Fixture mode hands back a '#…' URL and has nothing to upload to.
  if (!slot.uploadUrl.startsWith('#')) {
    const target = slot.uploadUrl.startsWith('/') ? `${API_BASE_URL}${slot.uploadUrl}` : slot.uploadUrl;
    const res = await fetch(target, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}). Please try again.`);
  }

  await apiClient.media.complete(slot.mediaId, dims);
  return { mediaId: slot.mediaId, publicUrl: slot.publicUrl, kind: slot.kind };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd frontend && npx vitest run services/mediaUpload.test.ts`
Expected: 7 tests pass.

- [ ] **Step 7: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Checkpoint.**

---

### Task 11: `MediaPreview` and the draft fields

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/MediaPreview.tsx`
- Test: `…/MediaPreview.test.tsx`
- Modify: `…/contentStudioTypes.ts`
- Modify: `…/DevicePreview.tsx`, `…/ValidateStage.tsx`, `…/PublishModal.tsx`
- Modify: `frontend/styles/index.css`, `frontend/styles/studio.css`

(`…` = `frontend/components/module-3/3.1-content-studio`.)

Design note: `mediaDataUrl` stays the single "is there media" field every existing consumer reads. For a video it holds a poster-frame JPEG (so the compliance audit and thumbnails work unchanged); playback uses the new `localVideoUrl`.

- [ ] **Step 1: Write the failing test**

`MediaPreview.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MediaPreview from './MediaPreview';

describe('MediaPreview', () => {
  it('renders an image when there is no video source', () => {
    render(<MediaPreview src="data:image/png;base64,AAA" alt="Attached media" />);

    const img = screen.getByRole('img', { name: 'Attached media' });
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  it('renders a playable video with the poster frame when a video source is given', () => {
    const { container } = render(
      <MediaPreview src="data:image/jpeg;base64,POSTER" videoSrc="blob:video-1" alt="Attached media" />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('blob:video-1');
    expect(video?.getAttribute('poster')).toBe('data:image/jpeg;base64,POSTER');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('passes the class name through', () => {
    const { container } = render(<MediaPreview src="x" alt="" className="media-full" />);
    expect(container.querySelector('img')?.className).toBe('media-full');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run components/module-3/3.1-content-studio/MediaPreview.test.tsx`
Expected: FAIL — cannot resolve `./MediaPreview`.

- [ ] **Step 3: Implement `MediaPreview`**

```tsx
/**
 * The staged media: an image, or — for video — a playable <video> whose poster
 * is the captured frame. One component so the composer, validate stage, full-size
 * modal and device preview all treat video the same way.
 */
interface MediaPreviewProps {
  /** The image, or the poster frame for a video. */
  src: string;
  /** Object URL for playback; present only for video. */
  videoSrc?: string | null;
  alt: string;
  className?: string;
}

export default function MediaPreview({ src, videoSrc, alt, className }: MediaPreviewProps) {
  if (videoSrc) {
    return (
      <video
        className={className}
        src={videoSrc}
        poster={src}
        controls
        muted
        playsInline
        aria-label={alt || undefined}
      />
    );
  }
  return <img className={className} src={src} alt={alt} />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run components/module-3/3.1-content-studio/MediaPreview.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Extend the draft type**

In `contentStudioTypes.ts`, add above `export interface PublishDraftState {`:

```ts
export type MediaType = 'image' | 'video';

/** Where the background upload of the staged media stands. */
export type MediaUploadState =
  | { status: 'uploading' }
  | { status: 'ready'; mediaId: string; publicUrl: string }
  | { status: 'failed'; message: string };
```

and add these fields to `PublishDraftState`, directly after `mediaDataUrl: string | null;`:

```ts
  /**
   * For a video, `mediaDataUrl` is a poster frame (so the compliance audit and
   * thumbnails read it like any image) and this is the playback object URL.
   */
  localVideoUrl?: string | null;
  mediaType?: MediaType;
  /** Absent for drafts that never uploaded (fixtures, restored drafts). */
  mediaUpload?: MediaUploadState | null;
```

- [ ] **Step 6: Use `MediaPreview` in `DevicePreview`**

In `DevicePreview.tsx`: add `import MediaPreview from './MediaPreview';` with the other imports; add `videoSrc?: string | null;` to `DevicePreviewProps` (below `mediaDataUrl`); destructure it in the component props (`{ platform, caption, mediaDataUrl, videoSrc, device = 'mobile', accountName = 'Your business' }`); and replace `<img src={mediaDataUrl} alt="" />` with:

```tsx
            <MediaPreview src={mediaDataUrl} videoSrc={videoSrc} alt="" />
```

In `PublishModal.tsx`, on the `<DevicePreview … mediaDataUrl={draft.mediaDataUrl}` element add the prop `videoSrc={draft.localVideoUrl}`.

- [ ] **Step 7: Use `MediaPreview` in `ValidateStage`**

Add `import MediaPreview from './MediaPreview';`, then replace

```tsx
              <img src={draft.mediaDataUrl} alt="Attached media" />
```
with
```tsx
              <MediaPreview src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Attached media" />
```
and replace the full-size modal line
```tsx
        {draft.mediaDataUrl && <img className="media-full" src={draft.mediaDataUrl} alt="Publication media at full size" />}
```
with
```tsx
        {draft.mediaDataUrl && (
          <MediaPreview className="media-full" src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Publication media at full size" />
        )}
```

- [ ] **Step 8: Let CSS size videos like images**

Read each rule, then extend the selector so `video` is styled like `img`:
- `frontend/styles/index.css` ~L4052: `.media-frame img {` → `.media-frame img,\n  .media-frame video {`
- `frontend/styles/index.css` ~L5391: `.device-media img {` → `.device-media img,\n  .device-media video {`
- `frontend/styles/studio.css` ~L2736: `.val-media img {` → `.val-media img, .val-media video {`

(`.media-full` is a class selector and already applies to either element.)

- [ ] **Step 9: Run the affected existing tests**

Run: `cd frontend && npx vitest run components/module-3/3.1-content-studio/DevicePreview.test.tsx components/module-3/3.1-content-studio/PublishModal.test.tsx components/module-3/3.1-content-studio/ValidateStage`
Expected: pass (image rendering is unchanged).

- [ ] **Step 10: Checkpoint.**

---

### Task 12: Video poster capture

**Files:** Create `…/videoPoster.ts` (no unit test — jsdom has no video decoding or canvas; it is mocked in Task 13 and covered by the manual check in Task 14)

- [ ] **Step 1: Implement**

```ts
/**
 * Reads a video file's first frame as a JPEG data URL, plus its dimensions and
 * length. The poster stands in for the video everywhere that expects an image
 * (the compliance audit, thumbnails); the dimensions go to the API so publishers
 * can check aspect ratio and duration later.
 */
export interface VideoInfo {
  posterDataUrl: string;
  width: number;
  height: number;
  durationSeconds: number;
}

const MAX_POSTER_WIDTH = 960;

export function captureVideoPoster(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('That video could not be read.'));
    };
    video.onloadedmetadata = () => {
      // A hair past 0 avoids the blank first frame some encoders emit.
      video.currentTime = Math.min(0.1, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, MAX_POSTER_WIDTH / (video.videoWidth || MAX_POSTER_WIDTH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const info: VideoInfo = {
          posterDataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds: Math.round(video.duration || 0),
        };
        cleanup();
        resolve(info);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('That video could not be read.'));
      }
    };

    video.src = url;
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Checkpoint.**

---

### Task 13: Composer — accept video, upload in the background, show status

**Files:**
- Modify: `…/PublishComposer.tsx`
- Modify: `…/AttachStage.tsx`
- Modify: `…/ContentStudioView.tsx`
- Test: `…/PublishComposer.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `PublishComposer.test.tsx`: update the existing assertion at ~L141 from `'Upload PNG, JPG, or WEBP'` to `'Upload an image or video'`. Then add (imports at top: `import { beforeEach } from 'vitest';` merged into the existing vitest import, plus the mocks below, placed after the existing imports):

```tsx
const uploadMediaMock = vi.fn();
vi.mock('../../../services/mediaUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mediaUpload')>()),
  uploadMedia: (...args: unknown[]) => uploadMediaMock(...args),
}));
vi.mock('./videoPoster', () => ({
  captureVideoPoster: vi.fn(() => Promise.resolve({
    posterDataUrl: 'data:image/jpeg;base64,POSTER', width: 1080, height: 1920, durationSeconds: 12,
  })),
}));
```

and this block at the end of the file:

```tsx
describe('PublishComposer — media upload', () => {
  beforeEach(() => {
    uploadMediaMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:local-video');
    URL.revokeObjectURL = vi.fn();
  });

  function renderMediaComposer(onDraftChange = vi.fn(), draft: Partial<PublishDraftState> = {}) {
    const utils = render(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, ...draft }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
          part="media"
        />
      </OverlayStackProvider>,
    );
    const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
    return { ...utils, input, onDraftChange };
  }

  it('stages an image locally, then uploads it and records the ready state', async () => {
    uploadMediaMock.mockResolvedValue({ mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });
    const { input, onDraftChange } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'image', localVideoUrl: null }),
    ));
    expect(onDraftChange).toHaveBeenCalledWith({ mediaUpload: { status: 'uploading' } });
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg' } },
    ));
  });

  it('stages a video as a poster frame plus a playback URL and passes its dimensions to the upload', async () => {
    uploadMediaMock.mockResolvedValue({ mediaId: 'v1', publicUrl: 'https://cdn/v1.mp4', kind: 'video' });
    const { input, onDraftChange } = renderMediaComposer();
    const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

    await userEvent.upload(input, file);

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      mediaDataUrl: 'data:image/jpeg;base64,POSTER', mediaType: 'video', localVideoUrl: 'blob:local-video',
    })));
    expect(uploadMediaMock).toHaveBeenCalledWith(file, { width: 1080, height: 1920, durationSeconds: 12 });
  });

  it('rejects an unsupported file type with a clear message and does not upload', async () => {
    const { input } = renderMediaComposer();

    // applyAccept: false — the input's accept filter would otherwise swallow the file first.
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t supported/);
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('rejects an image over 8 MB', async () => {
    const { input } = renderMediaComposer();
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, big);

    expect(await screen.findByRole('alert')).toHaveTextContent(/over 8 MB/);
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('reports a failed upload and offers a retry', async () => {
    // One mounted instance throughout: Retry re-runs the file picked below, which the
    // component remembers in a ref.
    uploadMediaMock.mockRejectedValueOnce(new Error('Upload failed (403). Please try again.'));
    const { input, onDraftChange, rerender } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } },
    ));

    // The parent would now re-render the composer with the failed state.
    rerender(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,AAA', mediaType: 'image',
            mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
          part="media"
        />
      </OverlayStackProvider>,
    );
    uploadMediaMock.mockResolvedValueOnce({ mediaId: 'm2', publicUrl: 'https://cdn/m2.png', kind: 'image' });

    await userEvent.click(screen.getByRole('button', { name: 'Retry upload' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'm2', publicUrl: 'https://cdn/m2.png' } },
    ));
  });

  it('removing the media clears the upload state and revokes the video URL', async () => {
    const { onDraftChange } = renderMediaComposer(vi.fn(), {
      mediaDataUrl: 'data:image/jpeg;base64,POSTER', mediaType: 'video', localVideoUrl: 'blob:local-video',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove media' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-video');
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      mediaDataUrl: null, localVideoUrl: null, mediaUpload: null,
    }));
  });

  it('shows the uploading and failed states', () => {
    const { rerender } = renderMediaComposer(vi.fn(), {
      mediaDataUrl: 'data:image/png;base64,AAA', mediaUpload: { status: 'uploading' },
    });
    expect(screen.getByText('Uploading media…')).toBeTruthy();

    rerender(
      <OverlayStackProvider>
        <PublishComposer draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,AAA',
          mediaUpload: { status: 'failed', message: 'Storage said no.' } }}
          onDraftChange={vi.fn()} audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram" part="media" />
      </OverlayStackProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Storage said no.');
    expect(screen.getByRole('button', { name: 'Retry upload' })).toBeTruthy();
  });
});
```

(`waitFor`, `within`, `userEvent`, `screen`, `render`, `vi`, `OverlayStackProvider`, `PublishDraftState` and `DRAFT` are already imported/defined at the top of this test file; add `beforeEach` to the `vitest` import if missing.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run components/module-3/3.1-content-studio/PublishComposer.test.tsx`
Expected: the new tests FAIL (and the updated "Upload an image or video" assertion fails).

- [ ] **Step 3: Update `PublishComposer.tsx` — imports**

After `import type { ComposerSlotProps, PublishDraftState } from './contentStudioTypes';` add:

```tsx
import MediaPreview from './MediaPreview';
import { captureVideoPoster } from './videoPoster';
import { MEDIA_LIMITS, mediaKindOf, uploadMedia } from '../../../services/mediaUpload';
import type { MediaDimensions } from '../../../services/mediaUpload';
```

- [ ] **Step 4: Update `blockReason`**

Change the message `'Add a PNG, JPG, or WEBP image to run the audit.'` to `'Add an image or video to run the audit.'`.

- [ ] **Step 5: Replace `readImage` with the media pipeline**

Replace the whole `readImage` function (currently `PublishComposer.tsx:95-110`, from `const readImage = (file: File | undefined) => {` through its closing `};`) with the following. Keep the `dragging` and `fileError` state lines above it.

```tsx
  // A pick that finishes uploading after the operator chose or removed something
  // else must not overwrite the newer state.
  const uploadSeq = useRef(0);
  const pending = useRef<{ file: File; dims: MediaDimensions } | null>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const startUpload = async (file: File, token: number, dims: MediaDimensions) => {
    onDraftChange({ mediaUpload: { status: 'uploading' } });
    try {
      const uploaded = await uploadMedia(file, dims);
      if (token !== uploadSeq.current) return;
      onDraftChange({ mediaUpload: { status: 'ready', mediaId: uploaded.mediaId, publicUrl: uploaded.publicUrl } });
    } catch (err) {
      if (token !== uploadSeq.current) return;
      onDraftChange({
        mediaUpload: { status: 'failed', message: err instanceof Error ? err.message : 'Upload failed. Please try again.' },
      });
    }
  };

  const readMedia = async (file: File | undefined) => {
    if (!file) return;
    // Rejected files used to vanish silently; say why instead.
    const kind = mediaKindOf(file.type);
    if (!kind) {
      setFileError('That file type isn’t supported — use a PNG, JPG or WEBP image, or an MP4 or MOV video.');
      return;
    }
    const limit = MEDIA_LIMITS[kind];
    if (file.size > limit) {
      setFileError(`That ${kind} is over ${limit / (1024 * 1024)} MB — use a smaller file.`);
      return;
    }
    setFileError(null);

    const token = ++uploadSeq.current;
    if (draft.localVideoUrl) URL.revokeObjectURL(draft.localVideoUrl);

    let dims: MediaDimensions = {};
    try {
      if (kind === 'image') {
        const dataUrl = await readFileAsDataUrl(file);
        if (token !== uploadSeq.current) return;
        onDraftChange({ mediaDataUrl: dataUrl, mediaType: 'image', localVideoUrl: null, mediaUpload: null, agreementChecked: false });
      } else {
        // The poster is what the audit reads; playback uses the object URL.
        const info = await captureVideoPoster(file);
        if (token !== uploadSeq.current) return;
        onDraftChange({
          mediaDataUrl: info.posterDataUrl,
          mediaType: 'video',
          localVideoUrl: URL.createObjectURL(file),
          mediaUpload: null,
          agreementChecked: false,
        });
        dims = { width: info.width, height: info.height, durationSeconds: info.durationSeconds };
      }
    } catch {
      setFileError('We couldn’t read that file — try another one.');
      return;
    }

    pending.current = { file, dims };
    void startUpload(file, token, dims);
  };

  const retryUpload = () => {
    const last = pending.current;
    if (last) void startUpload(last.file, uploadSeq.current, last.dims);
  };

  const removeMedia = () => {
    uploadSeq.current += 1; // abandon any in-flight upload
    pending.current = null;
    if (draft.localVideoUrl) URL.revokeObjectURL(draft.localVideoUrl);
    onDraftChange({ mediaDataUrl: null, mediaType: undefined, localVideoUrl: null, mediaUpload: null, agreementChecked: false });
  };
```

- [ ] **Step 6: Update the composer JSX**

1. Preview: replace `<img src={draft.mediaDataUrl} alt="Publication media preview" />` with
   `<MediaPreview src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Publication media preview" />`.
2. Remove button: change `onClick={() => onDraftChange({ mediaDataUrl: null, agreementChecked: false })}` to `onClick={removeMedia}`.
3. Drop handler: `readImage(event.dataTransfer.files?.[0]);` → `void readMedia(event.dataTransfer.files?.[0]);`
4. Upload zone copy: `Upload PNG, JPG, or WEBP` → `Upload an image or video`; `Up to 20 MB` → `Images up to 8 MB, videos up to 250 MB`.
5. File input: `accept="image/png,image/jpeg,image/webp"` → `accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"`, and in its `onChange` replace `readImage(event.target.files?.[0]);` with `void readMedia(event.target.files?.[0]);`.
6. After the line `{fileError && <p className="upload-error" role="alert">{fileError}</p>}` add:
   ```tsx
          {draft.mediaUpload?.status === 'uploading' && (
            <p className="text-meta mt-3" role="status">Uploading media…</p>
          )}
          {draft.mediaUpload?.status === 'failed' && (
            <p className="upload-error" role="alert">
              {draft.mediaUpload.message}{' '}
              <button type="button" className="link-inline" onClick={retryUpload}>Retry upload</button>
            </p>
          )}
   ```
7. Full-size modal: replace `<img className="media-full" src={draft.mediaDataUrl} alt="Publication media at full size" />` with
   `<MediaPreview className="media-full" src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Publication media at full size" />`.

- [ ] **Step 7: Update the Attach stage requirements**

In `AttachStage.tsx` replace the `REQUIREMENTS` entries:
`'PNG, JPG, or WEBP format'` → `'PNG, JPG or WEBP image, or MP4 / MOV video'` and
`'Maximum file size: 20 MB'` → `'Maximum file size: 8 MB for images, 250 MB for video'`.
If any existing test asserts the old strings, update it to the new text.

- [ ] **Step 8: Block publishing while an upload is unresolved**

In `ContentStudioView.tsx`, change the `canPublish` line to:

```tsx
  const mediaUploadSettled = draft.mediaUpload?.status !== 'uploading' && draft.mediaUpload?.status !== 'failed';
  const canPublish = Boolean(draft.caption.trim() && draft.mediaDataUrl && mediaUploadSettled && audit.result?.status === 'Pass');
```

(Drafts without `mediaUpload` — fixtures, restored drafts — stay publishable, so existing flows and tests are unaffected.)

- [ ] **Step 9: Run to verify it passes**

Run: `cd frontend && npx vitest run components/module-3/3.1-content-studio/PublishComposer.test.tsx`
Expected: all tests in the file pass.

- [ ] **Step 10: Run the whole Content Studio suite and type-check**

Run: `cd frontend && npx vitest run components/module-3 services && npx tsc --noEmit`
Expected: pass, no new type errors. Fix any test that asserted the old "20 MB" / "PNG, JPG, or WEBP" copy.

- [ ] **Step 11: Checkpoint.**

---

### Task 14: Full verification

- [ ] **Step 1: Backend** — `cd backend/spring-boot && ./mvnw -q test`. Expected: all pass.
- [ ] **Step 2: Frontend** — `cd frontend && npx vitest run && npm run build`. Expected: all pass; production build succeeds.
- [ ] **Step 3: Apply the migration to a real Postgres** (migrations are not covered by the H2 tests):
  ```bash
  cd /c/Users/austi/CeView/backend && docker compose up -d postgres
  cd spring-boot && SPRING_PROFILES_ACTIVE= ./mvnw -q spring-boot:run   # per RUNNING.md env for the Docker path
  ```
  Expected in the log: Flyway applies `V48 - module3 media asset` and the app starts with no Hibernate schema-validation error. Then `docker compose exec postgres psql -U <user> -d <db> -c "\d tbl_media_asset"` shows the table. (Use the exact env/credentials from `RUNNING.md`.)
- [ ] **Step 4: Manual local end-to-end** (backend + `npm run dev` per RUNNING.md, logged in as a seeded operator):
  1. Content Studio → Attach: upload a PNG. "Uploading media…" appears, then clears. File exists at `backend/spring-boot/media-uploads/media/<profileId>/<mediaId>.png`; `http://localhost:8080/media/<profileId>/<mediaId>.png` opens in the browser; DB row is `READY` with the real size.
  2. Upload an MP4 (≤ 250 MB): the composer shows a playable video with a poster; the compliance audit still runs on the poster; the file lands under `media-uploads/` and `READY` is set with width/height/duration.
  3. Upload a 9 MB image: rejected in the UI with "over 8 MB", no request sent.
  4. Stop the backend mid-upload (or block the PUT in devtools): composer shows the error with "Retry upload"; Retry succeeds after restoring.
  5. Remove the media: preview clears.
- [ ] **Step 5: Production smoke test** — after Part A of `docs/SOCIAL_PUBLISHING_SETUP.md` is done and a release is deployed, run its "Check it works" curl sequence. Expected: `HTTP/2 200` from CloudFront for the public URL.
- [ ] **Step 6: Final checkpoint** — list every changed file for the user (backend, frontend, deploy, docs). The user commits. Then, Phase 2 (connections) gets its own plan.

---

## Self-review against the spec

- **Phase 0:** IAM, CORS, CloudFront behavior, SSM, compose mapping, TikTok/Meta env mapping, setup/review docs, Graph-version note → Tasks 1–2. The Graph API version bump itself is intentionally deferred to Phase 2/ review prep and recorded in the setup doc (Part D).
- **Phase 1:** `MediaStorage` (S3 + local), `MediaController` (`/uploads`, `/complete`), V48, tenant-scoped keys, 8 MB / 250 MB limits, composer video support, `<video>` previews, compliance via poster, upload state on the draft → Tasks 3–13.
- **Spec item not done here:** switching the compliance call to the uploaded `publicUrl`. Deliberately left on the data URL (works for images and poster frames, needs no network round-trip); revisit if the audit ever needs the original video.
- **Type consistency:** `MediaStorage.uploadUrl(UUID, String, String)`, `LocalMediaStorage.write(String, InputStream, long)`, `MediaService.requestUpload/complete`, `UploadResponse/MediaResponse` fields, `MediaUploadSlot/MediaAssetDto` (frontend), `MediaUploadState` statuses (`uploading|ready|failed`), and `uploadMedia(file, dims)` are used with the same names and shapes in every task that references them.
