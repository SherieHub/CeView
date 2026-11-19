# Administrator model performance endpoint

`GET /api/admin/model-performance` returns aggregate JSON across businesses. It uses the existing Spring Boot login and a server-managed administrator allowlist. This cross-business aggregate endpoint is an explicit exception to normal operator-scoped access; it returns no raw inputs, user IDs, profile IDs, or individual run records.

## Access setup

1. Use an existing CeView account with verified email and a completed contact profile.
2. Obtain that account's `operatorId` from its successful `/api/auth/login` response.
3. Add that UUID to `CEVIEW_MODEL_PERFORMANCE_ADMIN_IDS` in the backend environment. Separate multiple UUIDs with commas, then restart Spring Boot. An empty value denies access to everyone; an invalid UUID fails configuration rather than broadening access.
4. Sign in with the account's existing password and send its JWT in the `Authorization: Bearer` header when requesting metrics. Removing an ID and restarting the backend revokes metrics access even if the account's token remains valid.

The setting grants access only to this performance report, not other administrative functions. No shared endpoint password or default administrator password exists. Authentication, token expiry, email verification, and contact-profile requirements continue to apply. Use HTTPS in deployment. A bare browser visit without an authorization header returns 401; this feature adds a JSON API, not a separate dashboard or login page.

For the AWS deployment, set `/ceview/prod/CEVIEW_MODEL_PERFORMANCE_ADMIN_IDS` in Parameter Store and use the existing secrets-refresh/deployment process. Both local and production Compose files forward this setting to Spring Boot.

Local PowerShell example using a password prompt:

```powershell
$credentials = Get-Credential -Message 'Sign in with your CeView administrator account'
$body = @{
    email = $credentials.UserName
    password = $credentials.GetNetworkCredential().Password
} | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/auth/login' -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($session.token)" }
Invoke-RestMethod -Uri 'http://localhost:8080/api/admin/model-performance' -Headers $headers
```

## Filters and response

| Query parameter | Meaning |
|---|---|
| `from` | Inclusive inference timestamp, ISO 8601 with timezone. Defaults to 30 days before `to`. |
| `to` | Exclusive inference timestamp. Defaults to the current UTC time. |
| `modelVersion` | Optional exact model-version match. Omit it to include all versions. |

`from` must precede `to`. Example date window: `?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`. The response echoes the selected window and version, includes a UTC generation timestamp, and sends `Cache-Control: no-store`.

- `summary`: total runs; analysis runs; confirmed and unconfirmed analysis runs; accepted and overridden counts; confirmation, override, and agreement rates; average raw top confidence; average, minimum, and maximum hosted inference latency in milliseconds.
- `breakdown`: the same metrics grouped by model version and run purpose (`ANALYZE` or `UNIQUENESS`).
- `topCategoryDistribution`: top-category run counts separated by run purpose.
- `measurementNotes`: limitations included with the data so downstream consumers do not mistake agreement for verified accuracy.

Rates use fractions from 0 to 1. Multiply by 100 to display percentages:

| Metric | Calculation |
|---|---|
| `confirmationRate` | Confirmed analysis runs / all analysis runs |
| `overrideRate` | Overridden confirmed analysis runs / confirmed analysis runs |
| `agreementRate` | Accepted confirmed analysis runs / confirmed analysis runs |
| `averageTopConfidence` | Sum of raw top confidence / total runs |
| `averageLatencyMs` | Sum of hosted request latency / total runs |

Empty denominators return `null`, not a fabricated zero. Unconfirmed runs never count as accepted. Uniqueness runs contribute to operational totals, latency and confidence, but never to feedback rates. The summary averages weight each run equally, rather than averaging model-version averages.

An accepted run means the saved category set matches the initially selected onboarding recommendations. Any change to that set counts as an override, following the [classification history contract](classification-run-history.md).

The timestamp filter selects inference runs. Confirmation fields reflect their current state, so a later confirmation can change a report for an earlier inference window. Repeated runs by the same business remain separate observations.

## Measurement boundaries

This report measures successful recorded inference runs and operator feedback. It cannot calculate failure rate, independently validated accuracy, precision, recall, or F1 from these records alone. User agreement is not verified ground truth, and model confidence is not a measured accuracy estimate. Latency includes hosted client setup, network and queue time.

The database performs grouping and aggregation without loading input text into the report service. Flyway V58 adds a time/version index for these queries. No model invocation occurs when viewing the report.

## Status codes

- `200`: allowlisted account, aggregate report returned, including empty datasets.
- `401`: missing, invalid, expired, or no-longer-valid account authentication.
- `403`: authenticated account is not allowlisted, or existing verification/profile requirements are unmet.
- `400`: malformed dates, reversed or empty date window, or blank/overlong model-version filter.
