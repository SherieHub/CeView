# Deploying CeView to AWS (Pilot)

This guide covers the production deployment of CeView for the MSME pilot. It deploys Postgres +
pgvector, Spring Boot, both FastAPI services and the React frontend to AWS in **Singapore
(`ap-southeast-1`)** for about **$30–33/month**.

- **Part A** explains what gets built and why: architecture, cost, security and Data Privacy Act (DPA)
  notes, risks, rollback and restore.
- **Part B** is the click-through runbook, in order.

The design rationale is in
[`docs/superpowers/specs/2026-10-01-aws-deployment-design.md`](superpowers/specs/2026-10-01-aws-deployment-design.md).

> **Before you start.** This guide uses the files in `deploy/aws/` and the workflow
> `.github/workflows/deploy-aws.yml`. Both must be merged to `main` first; Part B step B10 covers that.
> You need an email address and a credit or debit card for the AWS account, plus about half a day for
> the first run. DNS and certificate propagation account for most of the waiting.

---

## Values you'll fill in

Everything below uses these placeholders. Write your real values down once and reuse them everywhere.

| Placeholder | Meaning | Example |
|---|---|---|
| `<domain>` | The domain you buy in step B2 | `ceview-pilot.com` |
| `<account-id>` | Your 12-digit AWS account ID (top-right menu in the console) | `123456789012` |
| `<your-ip>` | Your current public IP, for SSH (search "what is my ip") | `203.0.113.7` |
| `<alert-email>` | Where alarm and budget emails go | `ops@ceview-pilot.com` |

Fixed names this guide uses (use them exactly; the scripts expect them):

| Resource | Name |
|---|---|
| Frontend bucket | `ceview-prod-site-<account-id>` |
| Ops bucket (backups + release bundles) | `ceview-prod-ops-<account-id>` |
| ECR repositories | `ceview/spring-boot`, `ceview/fastapi-sbert`, `ceview/fastapi-transformer` |
| GitHub deploy role | `ceview-github-deploy` |
| Box IAM user | `ceview-box` |
| Secrets path | SSM Parameter Store `/ceview/prod/…` |
| Lightsail instance / disk / IP | `ceview-prod-1` / `ceview-prod-data` / `ceview-prod-ip` |
| Log group | `/ceview/prod` |
| Deploy branch | `release` |

---

# Part A — The plan

## A1. Architecture

```
Browser ─HTTPS─> CloudFront (<domain>, www.<domain>) ──> S3 bucket (built React app)
   │
   └─HTTPS─> api.<domain> ──> Lightsail instance "ceview-prod-1" (4GB RAM, Ubuntu 24.04)
               Firewall: 443 + 80 open, 22 only from your IP and Lightsail browser SSH
               └ Caddy (automatic HTTPS) ──> spring-boot ──> fastapi-sbert ──┐
                                                         ──> fastapi-transformer
                                                         ──> postgres <──────┘
               Encrypted data disk at /data: Postgres data + the 1.1GB E5 model cache
```

- **One server runs the whole backend** with Docker Compose. Only Caddy is reachable from the internet.
  Postgres and both FastAPI services sit on a private Docker network. This matters because the FastAPI
  services have no authentication of their own.
- **There's no load balancer or CDN in front of the API.** Spring waits up to 90 seconds for AI calls,
  longer than AWS load balancers (60s) or CloudFront (30–60s) allow. Caddy has no such limit.
- **The frontend is static files** on S3, served worldwide by CloudFront.
- **Secrets live in AWS Systems Manager Parameter Store** (encrypted, free), never in the repo or in
  GitHub. The server copies them into a root-only `.env` file each time it deploys.

### How a release reaches the server

```
git push origin release
   └─> GitHub Actions (deploy-aws.yml), signed into AWS with OIDC, no stored keys
         1. builds 3 Docker images ─> ECR
         2. uploads deploy/aws/ bundle ─> s3://ceview-prod-ops-<account-id>/releases/<sha>/
         3. builds frontend ─> s3://ceview-prod-site-<account-id> + CloudFront invalidation
         4. writes <sha> to SSM parameter /ceview/prod/release-sha
                     │
Server, every 2 min: deploy.sh reads /ceview/prod/release-sha
   └─> new SHA? sync bundle, refresh .env, pull images, restart, wait for health
         ├─ healthy  ─> done
         └─ unhealthy ─> roll back to the previous SHA, log DEPLOY_FAILED (emails you)
```

The server **pulls** releases rather than GitHub **pushing** them, because Lightsail has no
remote-command service and the deployer doesn't have admin rights on the GitHub repo to store SSH
keys. Nothing secret is stored in GitHub at all.

## A2. Monthly cost estimate

These are list prices as of October 2026. Before you start, confirm them in the
[AWS Pricing Calculator](https://calculator.aws/) with Singapore selected.

| Item | ≈ USD/month |
|---|---|
| Lightsail Medium 4GB instance (2 vCPU, 80GB SSD, 4TB transfer, public IPv4 included) | 24.00 |
| Lightsail 20GB block-storage disk (`ceview-prod-data`) | 2.00 |
| Lightsail automatic snapshots (incremental) | 1.00–2.00 |
| Route 53 hosted zone + 1 health check | 0.50–1.25 |
| Domain registration (yearly, shown per month; `.com` is about $15/yr) | 1.25 |
| S3 (frontend + 30 days of DB dumps + release bundles) | 0.50 |
| ECR image storage (~3GB after lifecycle cleanup) | 0.30 |
| CloudFront (pilot traffic stays inside the always-free 1TB/month) | 0.00 |
| CloudWatch Logs (14-day retention) + 2 custom metrics + alarms | 1.50–2.50 |
| Parameter Store (standard tier), IAM, ACM certificate, CloudTrail event history | 0.00 |
| **Total** | **≈ 31–34** |

A new AWS account starts with $100 in credits, which can grow to $200 by completing onboarding tasks.
These usually cover the first few months; domain registration may not be covered. Lightsail
sometimes offers a free trial period on new accounts, so check what the console shows when you
create the instance.

**Costs outside AWS. Check these before go-live; they can exceed the AWS bill:**

| Service | Risk |
|---|---|
| **SerpApi** (Google Trends + cultural research) | The daily ingestion job queries per market × business category. With 20–100 businesses, the free quota will likely run out within days. Step B16 measures actual usage on day 1. Decide on a paid plan or fewer markets (`MODULE2_MARKETS`) before go-live. |
| **Groq** (all AI text and image analysis) | Free-tier rate limits. Under pilot load, expect `429` errors at busy moments. Check limits at console.groq.com and consider the paid developer tier. |
| **Resend** (sign-up verification and password-reset emails) | Free tier: 3,000 emails/month and **100/day**. Each sign-up or reset sends one, resends send more. The backend caps each account and each IP to protect the quota; if it is exhausted users see "We could not send the email right now". Move to a paid plan before a large invite wave. |
| **Hugging Face Space** (`FORECAST_ENGINE=bilstm`) | Free Spaces sleep when idle. The first forecast after a quiet period is slow and may time out once. |

## A3. Security and Data Privacy Act notes

> This section records the technical controls. It isn't legal advice. Have whoever owns the pilot's
> privacy obligations review it against the Data Privacy Act of 2012 and current NPC circulars
> (registration, breach notification, privacy notice).

**Personal data this deployment stores** (all in Postgres, Singapore):

| Data | Where |
|---|---|
| Operator accounts: name, email, contact number, bcrypt password hash | `tbl_msme_operator` |
| Business profiles, including uploaded images (stored inline as base64 text) | `tbl_business_profile` |
| Meta ad-account OAuth tokens, AES-encrypted with `TOKEN_ENCRYPTION_KEY` | `tbl_ad_platform_connection` |
| Traveller click data: salted SHA-256 of the IP (never the raw IP), user agent, referrer | `tbl_attribution_click` |
| Traveller enquiries submitted through `/enquiry` | `tbl_attribution_enquiry` |

**Controls in place:**

| Control | How |
|---|---|
| Data location | Database, backups, logs and secrets are all in `ap-southeast-1` (Singapore). CloudFront edge locations cache only the public static frontend, no personal data. |
| Encryption in transit | HTTPS everywhere: Caddy (Let's Encrypt) for the API, ACM certificate on CloudFront, HSTS. Traffic between containers stays inside one host's private Docker network. |
| Encryption at rest | Postgres data sits on an attached Lightsail block-storage disk. AWS documents attached disks and their snapshots as encrypted at rest by default. Backups in S3 use SSE-S3, and secrets use KMS (`aws/ssm`). |
| Access control | Root account protected by MFA and not used day to day. Humans use the `ceview-admin` IAM user with MFA. The server and CI each get their own least-privilege identity. SSH limited to one IP. The database isn't exposed to the internet. |
| Audit | CloudTrail event history (90 days, free) records every AWS API call, including every secret read. |
| Backups / recovery | Nightly encrypted database dumps kept 30 days, plus daily snapshots. A restore drill is documented (B16) and should be run monthly, with the date recorded. |
| Minimisation | Traveller IPs are hashed with a secret salt before storage. |

**Third-party processors (disclose these in the privacy notice).** Business descriptions, images and
generated captions are sent to **Groq** (US) for AI generation and analysis. Forecast inputs go to
**Hugging Face** (the `JamJamzz/*` Spaces). Search terms go to **SerpApi**. Operators' email addresses and first names go to **Resend** (US) to deliver verification and password-reset emails. Google sign-in goes through
**Firebase/Google**. Ad metrics come from **Meta**. The landing page and Meta's app settings both need a
privacy policy URL (`VITE_PRIVACY_URL`), and **a privacy notice must exist before go-live.**

## A4. Known risks and limits

| Risk | Mitigation |
|---|---|
| Single server, so a deploy or reboot interrupts the API for 30–90s | Release outside Cebu business hours, for example 22:00–06:00 PHT. |
| The frontend can update up to about 2 minutes before its matching backend | Keep API changes backward compatible for one release. |
| A long-lived IAM access key sits on the server (Lightsail has no instance roles) | The key can only pull images, read `/ceview/prod/*`, and write backups and logs. Rotate it quarterly (B18). |
| Only one Spring Boot instance can run: the scheduled jobs have no cross-instance lock | This design runs exactly one. Don't scale Spring horizontally without adding a lock first. |
| 4GB RAM is tight (sbert alone uses about 2GB) | Per-container memory limits plus 2GB swap. If memory alarms fire regularly, resize to Lightsail's 8GB plan (B18). |
| Rolling back across a migration that dropped or renamed columns breaks startup | Write additive migrations only. Roll forward instead of back when schema changed. |
| New Flyway seed migrations that reference the deleted demo accounts will fail in prod | Rule: no demo or seed rows in `db/migration` from now on. |
| Meta Ads for users outside the app's roles needs App Review and Business Verification | Until approved, add each pilot MSME's Facebook account as an app tester (B14). |

## A5. Rollback and restore at a glance

| Situation | Action |
|---|---|
| A release fails its health checks | Automatic: the server reverts to the previous release and emails you. |
| A release is healthy but buggy | `git revert` the change on `main`, fast-forward `release`, push. Rolls back frontend and backend together. |
| Emergency backend-only rollback | In CloudShell: `aws ssm put-parameter --name /ceview/prod/release-sha --value <older-sha> --overwrite`. The server picks it up within 2 minutes. Works for the last 10 releases. |
| Bad data or accidental deletion | Restore the last nightly dump (B16, "Restore for real"). |
| Server lost or broken | Create a new instance from the latest snapshot, attach the data disk or restore the newest dump, and move the static IP to it (B18). |

---

# Part B — Step-by-step instructions

Work through the steps in order. **Region:** unless a step says `us-east-1`, the console's region
selector (top right) must show **Asia Pacific (Singapore) ap-southeast-1**. Where a step needs a
terminal, use **AWS CloudShell** (the `>_` icon in the console's top bar). It already has the AWS CLI
and `openssl`, and it's signed in as you.

## B1. Create and secure the AWS account

1. Sign up at <https://aws.amazon.com/>. When asked to choose a plan, pick **Paid plan**. You still get
   the sign-up credits, and the Free plan closes the account after 6 months and blocks some
   services, including Lightsail's trial.
2. Signed in as **root**, go to *IAM → Dashboard → Add MFA for root user* and set up an authenticator app.
3. Create an admin user for daily work:
   1. *IAM → Users → Create user*. Name it `ceview-admin` and tick **Provide user access to the AWS
      Management Console**.
   2. *Attach policies directly* → **AdministratorAccess** → Create.
   3. Open the user → *Security credentials* → **Assign MFA device**.
4. Sign out, then sign back in as `ceview-admin` using the account's sign-in URL (shown on the IAM
   dashboard). **Do every remaining step as `ceview-admin`, not root.**
5. *Billing and Cost Management → Budgets → Create budget*:
   1. Choose **Customize**, **Cost budget**, Monthly, amount **$35**.
   2. Add alerts at 50%, 80% and 100% of *actual* cost, and 100% of *forecasted* cost, each emailing
      `<alert-email>`.

## B2. Buy the domain

1. *Route 53 → Registered domains → Register domains*. Search for a name and buy it, with auto-renew
   on. Turn on **privacy protection** (free for most TLDs).
2. Route 53 creates a **hosted zone** for the domain automatically. Confirm it under *Hosted zones*.
3. Wait for the registration email and click the verification link inside **15 days**, or the domain is
   suspended. Registration usually completes within an hour.

## B3. Request the HTTPS certificate for the frontend (`us-east-1`)

CloudFront only accepts certificates from `us-east-1`, so for this step **switch the region selector
to US East (N. Virginia)**.

1. *Certificate Manager → Request → Request a public certificate*.
2. Domain names: `<domain>` and `www.<domain>`. Validation: **DNS validation**.
3. Open the certificate → **Create records in Route 53** → Create records.
4. Wait for status **Issued**, usually 5–30 minutes. Switch the region back to **Singapore**.

## B4. Create the S3 buckets

**Frontend bucket**
1. *S3 → Create bucket* in Singapore. Name: `ceview-prod-site-<account-id>`.
2. Keep **Block all public access** on, since CloudFront reads it privately. Encryption: SSE-S3
   (default). Create.

**Ops bucket**
1. *S3 → Create bucket*. Name: `ceview-prod-ops-<account-id>`. Block all public access on, SSE-S3,
   **Bucket Versioning: Disable**. Create.
2. Open the bucket → *Management → Create lifecycle rule*:
   - Name `expire-backups`, prefix `backups/`, **Expire current versions after 30 days**.
3. Add a second rule:
   - Name `expire-releases`, prefix `releases/`, expire after **180 days**.

## B5. CloudFront distribution and DNS for the frontend

1. *CloudFront → Functions → Create function*:
   1. Name `ceview-spa-rewrite`, runtime **cloudfront-js-2.0**.
   2. Paste the contents of `deploy/aws/cloudfront/spa-rewrite.js` and replace `__DOMAIN__` with
      `<domain>`.
   3. Save, then use the **Publish** tab → Publish.
2. *CloudFront → Create distribution*:
   - **Origin domain:** pick the `ceview-prod-site-<account-id>` bucket.
   - **Origin access:** Origin access control settings → *Create new OAC* (defaults).
   - **Viewer protocol policy:** Redirect HTTP to HTTPS.
   - **Cache policy:** CachingOptimized. **Response headers policy:** SecurityHeadersPolicy.
   - **Function associations → Viewer request:** CloudFront Functions → `ceview-spa-rewrite`.
   - **Web Application Firewall:** *Do not enable* (it adds cost; revisit after the pilot).
   - **Price class:** Use North America, Europe, Asia, Middle East, and Africa.
   - **Alternate domain names:** `<domain>` and `www.<domain>`.
   - **Custom SSL certificate:** the certificate from B3.
   - **Default root object:** `index.html`.
   - Create.
3. CloudFront shows a banner saying the S3 bucket policy needs updating. Click **Copy policy**, open the
   bucket's *Permissions → Bucket policy*, paste it, and save.
4. Note the **Distribution ID** (for example `E1ABCDEF2GHIJK`).
5. *Route 53 → Hosted zones → `<domain>` → Create record*. Create four alias records, each with
   **Alias** on, *Alias to CloudFront distribution*, and your distribution selected:
   - `<domain>`, type A
   - `<domain>`, type AAAA
   - `www.<domain>`, type A
   - `www.<domain>`, type AAAA

The site shows an error until the first release uploads files in B10. That's expected.

## B6. Create the ECR image repositories

1. *Elastic Container Registry → Private registry → Repositories → Create repository*. Create three,
   with default settings: `ceview/spring-boot`, `ceview/fastapi-sbert`, `ceview/fastapi-transformer`.
2. For each one, open *Lifecycle policy → Create rule*:
   - Priority 1. Description "keep last 10".
   - Image status **Any**. Match criteria **Image count more than 10**. Action: expire.

## B7. Let GitHub Actions deploy into AWS (OIDC, no stored keys)

1. *IAM → Identity providers → Add provider* → **OpenID Connect**:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - Add provider.
2. *IAM → Roles → Create role* → **Custom trust policy**. Paste
   `deploy/aws/iam/github-deploy-trust.json` with `<account-id>` filled in. It only trusts pushes to the
   `release` branch of `SherieHub/CeView`. Click Next without attaching any policy, name the role
   `ceview-github-deploy`, and create it.
3. Open the role → *Add permissions → Create inline policy → JSON*. Paste
   `deploy/aws/iam/github-deploy-policy.json` with `<account-id>` and the Distribution ID filled in.
   Name it `ceview-github-deploy`. This policy lets CI push to the 3 ECR repos, write the frontend
   bucket and `releases/`/`bootstrap/` in the ops bucket, invalidate the distribution, and set only
   `/ceview/prod/release-sha`.
4. Note the role's **ARN**: `arn:aws:iam::<account-id>:role/ceview-github-deploy`.

## B8. Create the server's IAM identity

1. *IAM → Users → Create user*. Name it `ceview-box` with **no** console access.
2. *Attach policies directly → Create policy → JSON*. Paste `deploy/aws/iam/box-user-policy.json` with
   `<account-id>` filled in. Name it `ceview-box`, create it, then attach it to the user.

   The policy allows only:
   - ECR pull from the 3 repos
   - reading `/ceview/prod/*`
   - reading `releases/` and `bootstrap/`, and writing `backups/`, in the ops bucket
   - writing logs to `/ceview/prod`
   - publishing CloudWatch agent metrics
3. Open the user → *Security credentials → Create access key*:
   1. Use case: **Application running outside AWS**.
   2. Copy the **Access key ID** and **Secret access key** into your password manager now. The secret
      is shown only once. You'll paste them into the server in B11.

## B9. Store the secrets in Parameter Store

Create each parameter under *Systems Manager → Parameter Store → Create parameter* with **Tier:
Standard**, **Type: SecureString**, **KMS key: alias/aws/ssm**. Generate random values in CloudShell
with the commands shown. Use the hex and base64 output exactly; hex passwords avoid URL-escaping
problems.

| Name | Value |
|---|---|
| `/ceview/prod/POSTGRES_PASSWORD` | `openssl rand -hex 24` (Postgres superuser; break-glass only) |
| `/ceview/prod/DB_APP_PASSWORD` | `openssl rand -hex 24` (the `ceview` role the apps log in with) |
| `/ceview/prod/JWT_SECRET` | `openssl rand -hex 32` |
| `/ceview/prod/CEVIEW_ATTRIBUTION_IP_HASH_SALT` | `openssl rand -hex 16`. **Never change this after go-live**, or click de-duplication breaks. |
| `/ceview/prod/TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32`. **Never change this after go-live**, or stored Meta tokens can't be decrypted. |
| `/ceview/prod/GROQ_API_KEY` | From <https://console.groq.com/keys> |
| `/ceview/prod/HF_TOKEN` | A **read** token from <https://huggingface.co/settings/tokens> |
| `/ceview/prod/SERPAPI_KEY` | From <https://serpapi.com/manage-api-key> |
| `/ceview/prod/META_APP_ID` | From the Meta app (see [`AD_PLATFORM_SETUP.md`](../AD_PLATFORM_SETUP.md) §2) |
| `/ceview/prod/META_APP_SECRET` | Same place |
| `/ceview/prod/FIREBASE_CREDENTIALS_JSON` | The service-account JSON from [`RUNNING.md`](../RUNNING.md) §6 "Google Sign-In setup" step 3, **minified to one line**. In CloudShell, upload the file and run `jq -c . key.json`. |
| `/ceview/prod/EMAIL_PROVIDER` | The literal text `resend`. **Required:** the release fails its health check and rolls back without it. |
| `/ceview/prod/RESEND_API_KEY` | From Resend, see "Email delivery (Resend)" below |
| `/ceview/prod/EMAIL_FROM` | `CeView <no-reply@<domain>>`, an address on the domain verified in Resend |

Don't create `/ceview/prod/release-sha`; the first release creates it.

### Email delivery (Resend)

New accounts (and, once, every existing account) must enter a 6-digit emailed code before using the
app, and "Forgot password" uses the same codes. The server sends them through
[Resend](https://resend.com)'s HTTPS API (free tier: 3,000/month, 100/day).

1. Create a Resend account → **Domains → Add Domain**, using `<domain>` (a subdomain such as
   `mail.<domain>` also works if you prefer to keep the apex clean).
2. Resend shows DNS records (SPF and DKIM, plus a recommended DMARC). Add each in **Route 53 →
   Hosted zones → `<domain>` → Create record**, copying type, name and value exactly (TXT values go
   in quotes; MX/TXT records for a `send.` subdomain are normal). Wait until Resend shows **Verified**.
   Until then Resend only delivers to your own address.
3. Resend → **API Keys → Create API Key** with "Sending access". Store it as
   `/ceview/prod/RESEND_API_KEY`.
4. Create `/ceview/prod/EMAIL_PROVIDER` = `resend` and `/ceview/prod/EMAIL_FROM` =
   `CeView <no-reply@<domain>>` (an address on the verified domain).
5. Create all three **before** the release that ships this feature. If `EMAIL_PROVIDER` is missing the
   deploy rolls back; if the key or sender is missing Spring refuses to start. Either way the server
   reverts to the previous release and logs `DEPLOY_FAILED`.

**Existing pilot users:** that release adds a database migration that marks every current account as
unverified, so each operator is asked for an emailed code the next time they sign in. Tell them in
advance. The demo accounts are removed by B13, so none of them are affected. To change a value later,
use the "Change a secret" row in B18.

## B10. Configure and run the first release

The values in this step aren't secret: account ID, bucket names and public Firebase web config.
Committing them to the private repo is fine.

1. On a branch, fill in **`deploy/aws/deploy.env`**:
   ```
   AWS_REGION=ap-southeast-1
   AWS_ACCOUNT_ID=<account-id>
   DOMAIN=<domain>
   SITE_BUCKET=ceview-prod-site-<account-id>
   OPS_BUCKET=ceview-prod-ops-<account-id>
   CLOUDFRONT_DISTRIBUTION_ID=<distribution id from B5>
   GITHUB_DEPLOY_ROLE_ARN=arn:aws:iam::<account-id>:role/ceview-github-deploy
   ```
2. Fill in **`deploy/aws/frontend.production.env`**:
   - `VITE_API_BASE_URL=https://api.<domain>`
   - the four `VITE_FIREBASE_*` values (RUNNING.md §6 step 2)
   - `VITE_PRIVACY_URL` and `VITE_TERMS_URL` (required, see A3)
   - optionally `VITE_CONTACT_EMAIL` / `VITE_LEAD_FORM_ENDPOINT` / `VITE_WALKTHROUGH_URL`
   - **Never** set `VITE_USE_FIXTURES=true`; the production build refuses it.
3. Open a PR to `main`, get it reviewed, and merge it.
4. **Repo owner (one-time, needs admin on `SherieHub/CeView`):**
   - Confirm Actions are enabled and the account has Actions minutes left. A release uses about 15
     minutes; private repos on the Free plan get 2,000/month.
   - *Settings → Branches → Add rule* for `release`: restrict who can push, because anyone who can push
     `release` can deploy to production.
5. Create the deploy branch from the merged `main` and push it:
   ```bash
   git fetch origin
   git push origin origin/main:refs/heads/release
   ```
6. Watch *GitHub → Actions → deploy-aws*. When it's green:
   - `https://<domain>` shows the landing page. API calls fail until B12.
   - ECR has three images tagged with the commit SHA.
   - *Parameter Store* now has `/ceview/prod/release-sha`.

From now on, **releasing** means: merge to `main`, wait for CI to pass, then
`git push origin origin/main:release`. That push must be a fast-forward; never force-push `release`.

## B11. Create the Lightsail server

1. *Lightsail* (<https://lightsail.aws.amazon.com/>) → **Create instance**:
   - **Region:** Singapore, Zone A.
   - **Platform:** Linux/Unix. **Blueprint:** OS Only → **Ubuntu 24.04 LTS**.
   - **SSH key:** default (you'll mostly use browser SSH).
   - **Network type:** Dual-stack. **Plan:** the **4 GB RAM, 2 vCPUs, 80 GB SSD** bundle (about $24).
   - **Name:** `ceview-prod-1`. Create.
2. *Networking → Create static IP*: attach it to `ceview-prod-1` and name it `ceview-prod-ip`. Note the
   IP address.
3. *Storage → Create disk*: Singapore Zone A, **20 GB**, name `ceview-prod-data`. Attach it to
   `ceview-prod-1`. Don't format it; bootstrap does that.
4. Open the instance → **Networking** tab → IPv4 firewall. Make it exactly:
   - SSH, TCP 22: **Restrict to** `<your-ip>` and tick **Allow Lightsail browser SSH/RDP**.
   - HTTP, TCP 80: any IP (Let's Encrypt validation and the HTTP→HTTPS redirect).
   - HTTPS, TCP 443: any IP.

   Apply the same to the IPv6 firewall, minus SSH.
5. **Snapshots** tab → turn on **Automatic snapshots**, time **19:00 UTC** (after the nightly dump).
   On the disk's page, also turn on automatic snapshots for `ceview-prod-data`.
6. Back in **Route 53 → `<domain>` hosted zone → Create record**: `api`, type **A**, value = the static
   IP, TTL 300. Wait about 5 minutes, then check from CloudShell: `dig +short api.<domain>` should
   print the static IP.

## B12. Bootstrap the server

1. Lightsail → `ceview-prod-1` → **Connect using SSH** (browser terminal).
2. Install the AWS CLI and give the server its identity (the `ceview-box` key from B8):
   ```bash
   sudo snap install aws-cli --classic
   sudo aws configure
   #   AWS Access Key ID:     <ceview-box access key id>
   #   AWS Secret Access Key: <ceview-box secret>
   #   Default region name:   ap-southeast-1
   #   Default output format: json
   ```
3. Download and run the bootstrap script that the first release uploaded:
   ```bash
   sudo aws s3 cp s3://ceview-prod-ops-<account-id>/bootstrap/bootstrap.sh /root/bootstrap.sh
   sudo bash /root/bootstrap.sh ceview-prod-ops-<account-id>
   ```
   Bootstrap is safe to re-run. It does the following:
   - Formats (first run only) and mounts the data disk at `/data`.
   - Adds 2GB swap and turns on automatic security updates.
   - Installs Docker, the ECR credential helper and the CloudWatch agent.
   - Installs the `ceview-deploy` (every 2 minutes) and `ceview-backup` (daily) timers and the
     `ceview-compose` helper.
   - Runs the first deploy.

   The first deploy takes **10–15 minutes**, mostly pulling images and downloading the 1.1GB E5 model.
4. Watch progress:
   ```bash
   sudo tail -f /var/log/ceview/deploy.log      # ends with "DEPLOY_OK sha=…"
   sudo ceview-compose ps                        # all services "healthy" / "running"
   ```
5. Verify from your own machine:
   ```bash
   curl https://api.<domain>/actuator/health     # {"status":"UP",...}
   ```
   If you get a certificate error, Caddy is still getting the Let's Encrypt certificate. It needs B11
   step 6's DNS record to resolve. Check `sudo ceview-compose logs caddy`.

## B13. One-time data setup

Run this **once**, after B12 shows spring-boot healthy (Flyway migrations have then run):

```bash
sudo /opt/ceview/current/scripts/init-data.sh
```

It does two things, and is safe to run again:
1. **Imports the uniqueness reference corpus vectors** (64 rows). Without them, every business scores
   100 on uniqueness. Details: [`RUNNING.md`](../RUNNING.md) §5a.
2. **Deletes the 9 demo operator accounts** and all their demo data. Their passwords are published in
   `SEED_CREDENTIALS.md`. The 64 reference businesses are kept.

Verify:
```bash
sudo ceview-compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT embedding_model_version, COUNT(*) FROM tbl_business_embedding GROUP BY 1;"
# expect exactly one row, count 64
```
Then confirm a demo login fails, for example `ramon.delacruz@ceview.local` on `https://<domain>`.

## B14. Connect the third-party integrations

**Firebase (Google sign-in)**
- Firebase Console → *Authentication → Settings → Authorized domains* → add `<domain>` and
  `www.<domain>`.

**Meta Ads.** In the Meta app from [`AD_PLATFORM_SETUP.md`](../AD_PLATFORM_SETUP.md) §2 and §5:
- **Valid OAuth Redirect URIs:** `https://api.<domain>/api/ad-connections/meta/callback`. It must match
  exactly: no trailing slash. This replaces the tunnel URL used in local dev, and it never changes.
- **App Domains:** `<domain>`. **Privacy Policy URL:** your `VITE_PRIVACY_URL`.
- Until the app passes App Review and Business Verification for ads access, add each pilot MSME's
  Facebook account under *App Roles → Testers*. Only those accounts can connect.

**SerpApi, Groq and the HF Space**
- **Hugging Face:** open <https://huggingface.co/spaces/JamJamzz/ceview-demand-prediction-model> and
  confirm it's **Running**. If it's private, confirm the `HF_TOKEN` account has access.
- **Groq:** note your current rate limits at console.groq.com → Settings → Limits.

## B15. Monitoring and alerts

1. **Lightsail alarms.**
   1. Lightsail → *Account → Notification contacts* (top-right menu): add `<alert-email>` and confirm
      the email.
   2. Instance → **Metrics** tab:
      - **CPU utilization** alarm: above 80% for 3 of 3 datapoints over 5 minutes.
      - **Status check failures** alarm: ≥1.
2. **SNS topics** for CloudWatch alarms. One is needed in each region used:
   1. In **Singapore**: *SNS → Topics → Create topic*, Standard, named `ceview-alerts`. Create a
      subscription, protocol Email, to `<alert-email>`, and confirm the email.
   2. Switch to **us-east-1** and repeat (also named `ceview-alerts`). Route 53 health-check alarms only
      work there.
3. **Memory and disk alarms (Singapore).** Bootstrap's CloudWatch agent publishes
   `CWAgent / mem_used_percent` and `CWAgent / disk_used_percent`. *CloudWatch → Alarms → Create alarm*
   for each:
   - memory > 90% for 15 minutes
   - disk (path `/` and `/data`) > 80%

   Notify `ceview-alerts`.
4. **API health check (us-east-1).**
   1. *Route 53 → Health checks → Create*: Endpoint by domain name, HTTPS, `api.<domain>`, port 443,
      path `/actuator/health`, interval 30s.
   2. On the next page, create an alarm that notifies the us-east-1 `ceview-alerts` topic.
5. **Logs and the deploy-failure alarm (Singapore).**
   1. *CloudWatch → Log groups*: confirm `/ceview/prod` exists (containers and `deploy.log` stream
      there). Set **Retention: 14 days**.
   2. Open the log group → *Metric filters → Create*:
      - pattern `DEPLOY_FAILED`
      - metric namespace `CeView`, metric name `DeployFailed`, value 1
   3. Create an alarm on `DeployFailed` ≥ 1 in 5 minutes → `ceview-alerts`.
6. **Test:** force one alarm into the ALARM state from CloudShell. Use the Singapore memory alarm's name,
   which is shown in *CloudWatch → Alarms*:
   ```bash
   aws cloudwatch set-alarm-state --alarm-name <name> --state-value ALARM --state-reason test
   ```
   Confirm the email arrives.

## B16. Backups: verify, measure SerpApi, and practise a restore

**The morning after B12**
- Check that a backup exists:
  ```bash
  aws s3 ls s3://ceview-prod-ops-<account-id>/backups/pg/   # in CloudShell
  ```
- Check *SerpApi dashboard → searches used today* against your plan's monthly quota. If
  `daily usage × 30` exceeds the quota, act now: upgrade the plan or reduce `MODULE2_MARKETS`.
- Check the Lightsail **Snapshots** tab: one instance and one disk snapshot.

**Restore drill.** Run it once now and then monthly; record the date for DPA evidence. On the server:

```bash
LATEST=$(sudo aws s3 ls s3://ceview-prod-ops-<account-id>/backups/pg/ | sort | tail -1 | awk '{print $4}')
sudo aws s3 cp s3://ceview-prod-ops-<account-id>/backups/pg/$LATEST /tmp/restore.dump
sudo docker run -d --rm --name restore-test -e POSTGRES_PASSWORD=drill pgvector/pgvector:pg16
sleep 10
sudo docker exec restore-test psql -U postgres -c "CREATE ROLE ceview; CREATE DATABASE ceview OWNER ceview;"
sudo docker exec -i restore-test pg_restore -U postgres -d ceview --no-owner < /tmp/restore.dump
sudo docker exec restore-test psql -U postgres -d ceview -c "SELECT COUNT(*) FROM tbl_business_profile;"
sudo docker stop restore-test && sudo rm /tmp/restore.dump
```

The count should match production.

**Restore for real** (replaces production data with the dump). First download the dump you want to
`/tmp/restore.dump`: use the first two lines of the drill, or pick a specific date from the `aws s3 ls`
listing. Then:

```bash
sudo ceview-compose stop spring-boot fastapi-sbert
sudo ceview-compose exec -T postgres pg_restore -U ceview -d ceview --clean --if-exists --no-owner < /tmp/restore.dump
sudo ceview-compose start fastapi-sbert spring-boot
sudo rm /tmp/restore.dump
```

`pg_restore` may warn that it can't drop or create the `vector`/`pgcrypto` extensions, because the
superuser owns them. Those warnings are expected and harmless. Any other error means stop and
investigate before starting the services.

## B17. Go-live checklist

Tick every item before inviting MSMEs:

- [ ] `https://api.<domain>/actuator/health` → `UP`.
- [ ] `https://<domain>/` loads. A deep link such as `https://<domain>/enquiry` loads directly rather
      than returning a 404. `https://www.<domain>` redirects to `https://<domain>`.
- [ ] Register a brand-new operator with a real inbox: the "Your CeView verification code" email
      arrives (not in spam), the code works, and "Forgot password?" sends a reset code too (checks
      Resend and the Route 53 DNS records). If nothing arrives, check `sudo ceview-compose logs
      spring-boot` for `email provider rejected`.
- [ ] Register a brand-new operator, onboard, and get a uniqueness score that isn't the flat 100
      (checks E5 and the corpus).
- [ ] Generate a caption in Content Studio (checks Groq through sbert).
- [ ] Market Radar shows forecasts after the first daily run at 08:00 PHT (checks HF Space and
      SerpApi).
- [ ] "Continue with Google" works on `https://<domain>`.
- [ ] Connect a Meta ad account with a tester account. The callback returns to the app.
- [ ] Create an attribution link. Opening `https://api.<domain>/r/<slug>` redirects to
      `https://<domain>/enquiry?cv=…`, and submitting the enquiry records it.
- [ ] Demo logins (`*@ceview.local`) fail.
- [ ] `POST https://api.<domain>/api/admin/ingestion/trigger` with a valid operator token → `404`.
- [ ] `curl http://<static-ip>:8000/healthz` and `:5432` both time out, so the internal ports aren't
      exposed.
- [ ] A backup object exists, and the restore drill was done and dated.
- [ ] A test alarm email arrived. The budget alert is set.
- [ ] The privacy notice is published at `VITE_PRIVACY_URL` and names the third-party processors (A3).
- [ ] SerpApi and Groq quotas are confirmed adequate (A2).

## B18. Day-2 operations

| Task | How |
|---|---|
| **Release** | Merge to `main`, then `git push origin origin/main:release`. Watch Actions, then `sudo tail /var/log/ceview/deploy.log` on the server. |
| **See what's running** | `sudo ceview-compose ps`, and `cat /opt/ceview/state/deployed-sha`. |
| **Logs** | `sudo ceview-compose logs -f --tail=200 spring-boot`, or *CloudWatch → Log groups → /ceview/prod*. |
| **Change a secret** | Edit it in Parameter Store, then on the server: `sudo /opt/ceview/current/scripts/fetch-secrets.sh && sudo ceview-compose up -d`. |
| **Rotate the server key** (quarterly) | IAM → `ceview-box` → create a second access key. Then `sudo aws configure` on the server with the new key, `sudo systemctl restart docker amazon-cloudwatch-agent`, check the next deploy-timer run in `deploy.log`, and delete the old key. |
| **Emergency backend rollback** | See A5. |
| **Resize to 8GB** | Lightsail → Snapshots → create a snapshot → *Create new instance* from it with the 8GB plan. Detach `ceview-prod-data` from the old instance and attach it to the new one. Move the static IP. Delete the old instance after verifying. |
| **Replace a lost server** | Create an instance as in B11 (or from the latest snapshot), attach `ceview-prod-data` (or a disk restored from its snapshot), move the static IP, run B12. If the data disk is lost, restore the newest dump (B16). |
| **Patch the OS** | Unattended-upgrades applies security updates nightly. Reboot monthly outside business hours: `sudo reboot`. The stack restarts by itself. |

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| The release workflow fails at "Configure AWS credentials" | The push wasn't to `release`, or the trust policy's repo or branch doesn't match. Check B7 step 2. |
| `deploy.log` never shows the new SHA | The deploy timer is off (`systemctl status ceview-deploy.timer`), or the box key lacks SSM read permission. Check with `sudo aws ssm get-parameter --name /ceview/prod/release-sha`. |
| `fastapi-sbert` stays `starting` for over 10 minutes | E5 download is slow or failed. Check `sudo ceview-compose logs fastapi-sbert`. The cache on `/data/hf-cache` survives, so a restart resumes it. |
| A container keeps restarting with exit code 137 | Out of memory. Check `free -m` and the memory alarm, then consider resizing (B18). |
| Browser shows CORS errors | The frontend origin isn't `https://<domain>`, for example when testing from `www` before the redirect took effect, or `DOMAIN` in `deploy.env` is wrong. |
| Meta connect fails with "URL blocked" | The redirect URI in Meta doesn't exactly match `https://api.<domain>/api/ad-connections/meta/callback`. |
| AI features return 503 "dependency unavailable" | The Groq, SerpApi or HF key is missing or out of quota. Check Parameter Store, then run the "change a secret" steps. |
