# Hosted enquiry integration

The public frontend route is `/enquiry?cv=<clickId>`. Track 2 should redirect
links with no destination URL to this path on the frontend origin, preserving
the captured click id in `cv`.

The page reads `GET /api/public/attribution/enquiries/context?cv=<clickId>` for
`{ businessName }`, then posts the existing `EnquiryRequest` to
`/api/public/attribution/enquiries`. Public requests carry no operator token.
The receipt stays `{ received: true }`; no enquiry or business identifiers are
returned. Both reads and submissions reject unknown, expired or already-used
clicks with the same generic response.

The operator dashboard reads `GET /api/attribution/enquiries` with the current
JWT and refreshes once a minute. The server derives the tenant from that JWT.
The list uses an enquiry-specific DTO and compact cards with inline contact
details, newest first. Search matches names and contact details; client-side
pagination shows six enquiries per page. It does not write a generic
notification or change `NotificationDto`.

## Track 2 handoff

Track 2's `BotFilter` was absent when CVW-38 started. The user approved adding
a small shared limiter here so Track 2 can reuse it rather than creating a
second mechanism. `AttributionRateLimiter` provides `tryAcquire(remoteAddress)`,
`hashIp(remoteAddress)` and `tryAcquireHash(ipHash)`. Use the servlet remote
address, not an untrusted forwarded header. The limiter allows 30 requests per
IP hash per minute, keeps at most 10,000 active entries, and stores no raw IPs.
It is process-local; multiple application instances do not share a quota.

The enquiry filter covers the public context and submission paths, including
malformed requests. Track 2 remains responsible for redirect integration and
its bot/debounce checks. The H2 V22 migration adds the missing `is_reference`
column expected by the business profile entity. No security exemptions change here.
