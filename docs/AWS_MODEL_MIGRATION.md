# Migrating CeView's models to AWS (pilot, 5–10 users)

**Goal:** during the pilot, users never hit a third-party rate limit (Hugging Face ZeroGPU, Groq
free tier, Hub downloads). The only limits they see are ones we set: per-user, per-feature daily
caps. Cost target: as low as possible, paid from the $100–200 AWS signup credits.

**Starting point:** the app already runs on AWS (Lightsail 4 GB in `ap-southeast-1`, see
[`DEPLOY_AWS.md`](DEPLOY_AWS.md)). This guide only moves the *models*.

> **Status:** this is a runbook plus a code-change spec. The code in §5 is not written yet; each
> phase ships with tests and doc updates (`RUNNING.md` §8a). Facts marked **(verify)** came from
> third-party pages or docs read in October 2026 — confirm them in the AWS console before relying
> on them.

---

## 1. What moves, and where it goes

| Model | Used by | Today | After |
|---|---|---|---|
| `JamJamzz/ceview_sbert` | Module 1 classifier | HF Space via `gradio_client` | In-process in `fastapi-sbert`, weights from S3 |
| `JamJamzz/ceview-demand-prediction-model` | Module 2.2 forecast | HF Space via `gradio_client` | In-process in `fastapi-transformer`, weights from S3 |
| `intfloat/multilingual-e5-base` | Modules 1, 3.3 embeddings | Downloaded from HF Hub on first use | Loaded from S3-synced local dir, `HF_HUB_OFFLINE=1` |
| `openai/gpt-oss-120b` | 3.1 captions, 3.2 creative, Module 4 reports + PES | Groq | Bedrock `openai.gpt-oss-120b-1:0`, Groq as fallback |
| `qwen/qwen3.8-27b` (vision) | 3.3 OMCS compliance audit | Groq | Bedrock Amazon Nova 2 Lite (`global.amazon.nova-2-lite-v1:0`), Groq as fallback |

**Stays external (not models):** SerpApi (Google Trends, cultural research) and the Groq fallback.
SerpApi's quota is a separate risk, see `DEPLOY_AWS.md` "Costs outside AWS".

**Not used:** SageMaker. The models are small, traffic is a handful of requests a day, and an
always-on endpoint would burn credits while idle.

```
Browser ─► CloudFront/S3 (frontend)
        └► api.<domain> ─► Caddy ─► Spring Boot ──► per-user daily quota (Postgres)
                                        │
                      ┌─────────────────┴─────────────────┐
              fastapi-sbert                       fastapi-transformer
        E5 + classifier (in-process)          demand model (in-process)
        LLM calls ─► Bedrock ──fallback──► Groq
                      └── weights: S3 models/ ─sync─► /data/models (read-only mount)
```

## 2. Cost and credits

Bedrock is pay-per-token. Approximate prices **(verify on the AWS Bedrock pricing page)**:

| Model | Input / 1M tokens | Output / 1M tokens |
|---|---|---|
| gpt-oss-120b | ~$0.15 | ~$0.60 |
| Nova 2 Lite | ~$0.30 | ~$2.50 |

Daily quotas (§5, Phase 4) cap the worst case. At the default caps, a user who maxes out every
feature costs well under $0.25/day, so 10 users stay under ~$75/month even in the worst case;
expect ~$10–15 in practice. Add the server: Lightsail 4 GB is ~$31–34/month in total (see
`DEPLOY_AWS.md`), or ~$44 for the 8 GB plan **(verify)**.

**Do before go-live:**
1. Billing → **Credits**: confirm what the credits cover. The $100 base credit is not documented
   as covering Bedrock specifically; some AWS programs exclude model usage **(verify)**.
2. Billing → **Budgets**: create a monthly budget with alerts at 50/80/100%. (Completing this
   also earns a signup bonus credit.)
3. Cost Explorer: after day 1, filter by service "Amazon Bedrock" and check the real spend.

## 3. AWS prerequisites (console)

All in region **Singapore (ap-southeast-1)** unless stated.

1. **Bedrock → Model catalog:** open *OpenAI gpt-oss-120b* and *Amazon Nova 2 Lite*, accept any
   terms, and check the model's lifecycle status. gpt-oss-120b's page said "EOL no sooner than
   Aug 05, 2026" and that date has passed **(verify it is still Active)**. Nova 2 Lite says Dec 02,
   2026. Model IDs are env vars (§5, Phase 3), so swapping later is a config change.
2. **Service Quotas → Amazon Bedrock:** look up the on-demand *requests per minute* and *tokens per
   minute* for both models. New accounts can have low defaults, and exceeding them gives the same
   kind of 429 we are trying to escape. Request increases if the numbers are below the pilot's
   peak (a PES report makes up to 6 LLM calls).
3. **IAM:** add this statement to `deploy/aws/iam/box-user-policy.json`, then attach the updated
   policy to the box user. The ARNs below are the expected shape; **follow the Bedrock
   "cross-region inference" IAM docs exactly** for Nova's Global profile, which needs the
   inference-profile ARN *and* the underlying foundation-model ARNs:

   ```json
   {
     "Sid": "InvokeBedrockModels",
     "Effect": "Allow",
     "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
     "Resource": [
       "arn:aws:bedrock:ap-southeast-1::foundation-model/openai.gpt-oss-120b-1:0",
       "arn:aws:bedrock:ap-southeast-1:410133709862:inference-profile/global.amazon.nova-2-lite-v1:0",
       "arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0"
     ]
   }
   ```

   Also add `s3:GetObject` on `.../models/*` and the `models/*` prefix to the existing
   `ListOpsBucket` condition (§6).
4. **Smoke test from the Lightsail box** (SSH in, root has the credentials):

   ```bash
   aws bedrock-runtime converse --region ap-southeast-1 \
     --model-id openai.gpt-oss-120b-1:0 \
     --messages '[{"role":"user","content":[{"text":"Say OK"}]}]'
   aws bedrock-runtime converse --region ap-southeast-1 \
     --model-id global.amazon.nova-2-lite-v1:0 \
     --messages '[{"role":"user","content":[{"text":"Say OK"}]}]'
   ```

   `AccessDeniedException` means the policy ARNs are wrong. `ThrottlingException` on the first
   call means the quotas in step 2 are too low.

**Data routing note:** Nova 2 Lite has no Singapore or Asia-Pacific geo profile, only the Global
one **(verify)**. Images sent for the OMCS audit may be processed in any AWS region. This was
accepted for the pilot. If that changes, switch `BEDROCK_VISION_MODEL` to Qwen3 VL 235B, which runs
in Singapore on the `bedrock-mantle` endpoint **(verify)**, and re-validate.

## 4. Export the models from Hugging Face (one-time)

You own both Spaces, so you can clone them. Do this on your own machine.

1. Clone each Space repo (`git clone https://huggingface.co/spaces/JamJamzz/ceview_sbert`, same
   for `ceview-demand-prediction-model`). Use `git lfs pull` if the checkpoints are LFS files.
2. For each Space, read `app.py` and record: the framework (PyTorch, Keras, ...), the checkpoint
   file names, the exact preprocessing, the output format, and whether the classifier reuses the
   E5 encoder. **This determines the size of Phase 2, so do it first.**
3. Record the real input→output pairs for golden tests (§5, Phase 2) by calling the live Spaces
   with ~10 representative inputs and saving the results. Do this *before* switching anything.
4. Download E5 once: `huggingface-cli download intfloat/multilingual-e5-base --local-dir e5-base`.
5. Compute sha256 of each checkpoint and upload under the S3 layout below:

   ```
   s3://ceview-prod-ops-410133709862/models/
     e5-multilingual-base/<version>/...
     ceview_sbert/<version>/...
     demand_forecaster/<version>/...
   ```

   Use a version folder per model so a rollback is a config change, not a re-upload.

## 5. Code changes (spec)

Every change follows `skills/test-driven-development`: write the failing test first, and update
the docs listed in §8.

### Phase 1 — E5 offline + readiness (`fastapi-sbert`)
- `app/core/BertModel.py`: read `E5_MODEL_PATH`; if set, load `SentenceTransformer(path)`,
  otherwise fall back to the Hub id (local dev only).
- `app/main.py`: add a lifespan preload gated by `PRELOAD_E5_ENCODER` (prod compose already sets
  it, but nothing reads it today). Add `GET /readyz` that is 503 until the models are loaded.
  Keep `/healthz` instant.
- Tests: monkeypatch `SentenceTransformer`; assert the path is used and the Hub id is not; assert
  the preload flag triggers loading and `/readyz` flips.

### Phase 2 — Spaces in-process
- `fastapi-sbert/app/services/local_classifier.py`: loads `ceview_sbert` from
  `/data/models/ceview_sbert/<version>` and returns the same `(categories, confidences)` tuple
  as `hf_space_classifier.py:30`, so its existing mapping (OUT_OF_SCOPE > 0.75, ≥20% share, max 3)
  is reused as is. Choose with `CLASSIFIER_BACKEND=local|hf_space`. Share the `BertModel`
  singleton if the Space uses E5.
- `fastapi-transformer/app/services/local_demand_forecaster.py`: reproduces `/forecast`
  (52 weeks × `[trend/100, week_sin, week_cos]` + market + category → 12 weekly values,
  `model_version`, `checkpoint_sha256`). Register it as `FORECAST_ENGINE=local` in
  `forecast_engine.py`. Reuse the validation and error codes from `bilstm_forecaster.py`
  (`MOD22_INSUFFICIENT_HISTORY`, `MOD22_BILSTM_INVALID_RESPONSE`, confidence rules).
- Dependencies: whatever framework §4 step 2 found, CPU-only. `fastapi-transformer` has no torch
  today, so this can add a lot of image size and RAM — measure in §7.
- Tests: golden-output parity against the pairs saved in §4 step 3. Existing
  `test_hf_space_classifier.py` stays green for the `hf_space` backend.

### Phase 3 — Groq → Bedrock, Groq as fallback
- New `fastapi-sbert/app/core/llm_factory.py`: `text_llm()` and `vision_llm()` return
  `ChatBedrockConverse(...)` with `.with_fallbacks([ChatGroq(...)])`. Env vars:
  `BEDROCK_TEXT_MODEL` (default `openai.gpt-oss-120b-1:0`), `BEDROCK_VISION_MODEL` (default
  `global.amazon.nova-2-lite-v1:0`), `AWS_REGION`. No `GROQ_API_KEY` means no fallback is added.
- `AgentLLMModel.py`: build through the factory; keep the singleton, lock, `last_error` and the
  503 `cause` behaviour. Covers 3.1 captions and the Module 4 PES agent (`with_structured_output`).
  Check that gpt-oss reasoning text on Bedrock does not end up in the content the parsers read.
- `agents/omcs_agent/node.py`: use `vision_llm()`. Image blocks change from the OpenAI
  `image_url` format to Converse's image format. Nova is a different model family: **compare
  rubric scores on ~10 real audits against the current Groq output before trusting them.**
- `services/gemini_client.py` `_generate_json` (3.2 creative, Module 4 report/insights): call
  Bedrock Converse first, then the existing Groq client on exception; keep the `{}`-on-failure
  contract.
- Timeouts: set the boto client `read_timeout` below Spring's 90 s, and
  `retries={"mode": "adaptive", "max_attempts": 3}` so throttles back off before failing over.
- Dependencies: add `langchain-aws`, `boto3`.
- **Credentials in containers:** today only the host reads `/root/.aws`; containers get none.
  Mount it read-only and point boto at it, so no new secret is needed:

  ```yaml
  # deploy/aws/docker-compose.prod.yml, fastapi-sbert (and any service calling Bedrock)
  environment:
    AWS_REGION: ${AWS_REGION}
    AWS_SHARED_CREDENTIALS_FILE: /aws/credentials
    AWS_CONFIG_FILE: /aws/config
  volumes:
    - /root/.aws:/aws:ro
  ```

  Re-check `bootstrap.sh` and `lib.sh` for where the credentials file really lives (the snap-based
  Docker setup noted in `lib.sh:6` may differ) before relying on this path.
- Tests: stubbed Bedrock for (a) success, (b) `ThrottlingException` → Groq fallback, (c) Bedrock
  down and no Groq key → the existing 503 codes (`MOD31_LLM_UNAVAILABLE` etc.).

### Phase 4 — Per-user daily quotas (Spring Boot + frontend)
- Flyway `V45__ai_daily_usage.sql` (V44 is the latest) and the H2 mirror in `db/h2`:
  `tbl_ai_daily_usage(user_id, feature, usage_date, count, PRIMARY KEY (user_id, feature, usage_date))`.
- `AiQuotaService` in `com.ceview.ai`: `assertWithinQuota(userId, feature)` before the call;
  `INSERT … ON CONFLICT … DO UPDATE SET count = count + 1` after a **successful** response only.
  The user id comes from the JWT, so tenants stay isolated.
- Limits (env vars → `ceview.quota.*` in `application.yml`; a container restart applies a change):

  | Feature | Env var | Default / user / day |
  |---|---|---|
  | 3.1 captions | `CEVIEW_QUOTA_CAPTION` | 20 |
  | 3.2 creative direction | `CEVIEW_QUOTA_CREATIVE` | 20 |
  | 3.3 compliance audit | `CEVIEW_QUOTA_OMCS` | 15 |
  | Module 4 report + PES analysis | `CEVIEW_QUOTA_REPORT` | 5 |
  | Module 1 classify + uniqueness | `CEVIEW_QUOTA_CLASSIFY` | 10 |

  Forecasts are not capped (cached 6 h, and the daily job runs without a user).
- Apply at the callers of `AIInferenceGatewayService` (`generateCaption`, `generateCreative`,
  `analyzeOmcsAgent`, `generateReport`, `generatePesAnalysis`, `classifyCategories`,
  `computeUniqueness`). Skip system callers such as the ingestion job.
- Day boundary is midnight **Asia/Manila**. Over the limit: HTTP 429, code
  `QUOTA_DAILY_LIMIT_REACHED`, `Retry-After` set to the seconds until reset. Add
  `GET /api/ai/quota` returning remaining uses per feature.
- Frontend: handle that 429 in `apiError.ts` / `apiClient.ts` (today only 404 and 409 are
  special-cased) and show the reset time; optionally show remaining uses beside the generate
  buttons in `components/module-3` and `module-4`.
- Tests: JUnit for limit reached, Manila rollover, failures not counted, per-user isolation; a
  WebMvc test for the 429 and `Retry-After`; Vitest for the message.

## 6. Box changes (`deploy/aws/`)

1. `scripts/deploy.sh`: after the release sync, add
   `aws s3 sync --region "$AWS_REGION" --only-show-errors s3://$OPS_BUCKET/models/ /data/models/`
   (no `--delete` unless you want removed versions to disappear). `/data` is the persistent disk.
2. `docker-compose.prod.yml`: mount `/data/models:/models:ro` into `fastapi-sbert` and
   `fastapi-transformer`; set `E5_MODEL_PATH=/models/e5-multilingual-base/<version>`,
   `CLASSIFIER_BACKEND=local`, `FORECAST_ENGINE=local`, `HF_HUB_OFFLINE=1`; add the Bedrock env vars
   and credential mount from Phase 3; add the `CEVIEW_QUOTA_*` vars to `spring-boot`.
3. Remove the `/data/hf-cache` mount from `fastapi-sbert` once E5 loads from `/models`, and drop
   `HF_TOKEN` / `HF_SPACE_ID` / `HF_DEMAND_SPACE` once nothing reads them (keep them while
   `CLASSIFIER_BACKEND=hf_space` is still an option for rollback).
4. Point the `fastapi-sbert` healthcheck at `/readyz` (the preload makes `start_period: 600s`
   shorter in practice). Update `deploy.sh`'s health gate if it checks `/healthz` today.
5. `iam/box-user-policy.json`: the Bedrock statement from §3 and the `models/*` S3 permissions.

## 7. Measure memory, then decide on 8 GB

Today the 4 GB box is tight: sbert is capped at 2200 MB, transformer at 600 MB, Spring at 900 MB,
plus Postgres 512 MB, with 2 GB of swap. Two more in-process models could break that.

1. Deploy to the box (or a copy), then run a scripted load that hits classify, uniqueness, OMCS
   (E5 encode), a forecast batch, and a report.
2. Watch `docker stats --no-stream` and `free -m` during the load.
3. **Decision rule:** if the peak total plus ~0.7 GB headroom exceeds ~3.3 GB, or swap is in
   constant use, or the CloudWatch memory alarm fires, resize.
4. Resize: Lightsail → instance → snapshot first → **Create new instance from snapshot** on the
   8 GB plan (~$44/month **verify**), then re-attach the `ceview-prod-ip` static IP and the
   `ceview-prod-data` disk. Raise the `mem_limit`s in compose to match. The runbook for the
   original build is `DEPLOY_AWS.md` B11.

## 8. Docs to update alongside the code

`docs/DEPLOY_AWS.md` (link here; update the diagram, cost table, SSM list, external-risks table),
`RUNNING.md` (env var table, local model fetch), `backend/CONTRACT.md` (429 shape,
`GET /api/ai/quota`), `docs/module-1/`, `docs/module-2/TRANSFORMER_MODEL_INTEGRATION.md`,
`docs/module-3/`, `docs/module-4/`, plus both compose files.

## 9. Cutover, rollback, operations

**Cutover order** (each step is independently reversible):
1. S3 models uploaded; IAM and Bedrock smoke test pass (§3, §4).
2. Ship Phase 1 and 2 with `CLASSIFIER_BACKEND=hf_space` and `FORECAST_ENGINE=bilstm` still set, so
   behaviour is unchanged. Then flip each to `local` one at a time and compare against the
   golden outputs.
3. Ship Phase 3. Test Bedrock on a copy first, then in prod. Watch the logs for fallback events.
4. Ship Phase 4 and set the quota values.
5. Measure (§7), resize if needed.

**Rollback:** deploys go through the `release` branch; to go back, point SSM
`/ceview/prod/release-sha` at the previous commit (`deploy.sh` already rolls back automatically if
the health gate fails). Config-only rollbacks: set `CLASSIFIER_BACKEND=hf_space`,
`FORECAST_ENGINE=bilstm`, or an invalid `BEDROCK_*` model so every call takes the Groq fallback.

**Verification before announcing the pilot:**
- Block `huggingface.co` from the box (or run with `HF_HUB_OFFLINE=1` and no `HF_TOKEN`); every
  feature should still work.
- Fallback drill: set `BEDROCK_TEXT_MODEL` to a bad id → calls succeed via Groq and log it; then
  unset `GROQ_API_KEY` → the documented 503 codes appear.
- Quota drill: `CEVIEW_QUOTA_CAPTION=2`; the third caption returns 429 with the reset time in the
  UI, and a second user is unaffected.
- Run the Playwright suite in `e2e/` against the deployed stack.

**Ongoing:**
- Watch CloudWatch logs for Bedrock throttling and fallback lines, and Cost Explorer daily.
- Change a quota: edit the SSM/compose value and restart `spring-boot`.
- Bump a model: upload a new `<version>` folder to S3, change the version in compose, deploy.
- The IAM key now also guards Bedrock spend. Rotate it quarterly (`DEPLOY_AWS.md` B18).

## 10. Open risks

- **Space internals are unknown until §4 is done** (framework, size, E5 reuse). Phase 2 effort and
  the RAM impact are estimates until then.
- **Default Bedrock quotas on a new account may be low** (§3 step 2).
- **Nova 2 Lite may score the OMCS rubric differently** from qwen3.8; validate before relying on it.
- **Credits may not cover Bedrock** (§2); a bad assumption here turns into a real bill.
- **SerpApi still limits Module 2 and cultural research** and is unaffected by this migration.
- **Spring's 90 s timeout** is shared by Bedrock retries plus a Groq fallback; keep the boto
  timeout and retry settings small enough that the total fits.
