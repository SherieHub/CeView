# Screen — Settings → Platforms

**Route:** `/settings/platforms` · **Module:** 3 (publishing) · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:4267–4284`](../../../ui-ux-prototype.html#L4267)
(`platforms` panel inside `renderSettings()`), [`:4131–4202`](../../../ui-ux-prototype.html#L4131)
(`connectPlatform`, `grantScope`, `finishConnect`, `disconnectPlatform`).

**Component:** `components/module-3/settings/PlatformsSettings.tsx` — new.

## Purpose

Connect or disconnect the four publishing destinations (Instagram, TikTok, Facebook, Naver Blog).
Connection state gates the [Content Studio](content-studio.md) publish-to picker (Decision 2 of the
overhaul — see the frontend plan).

## Layout

One row per platform: icon, label, connected/not-connected status text, and either a "Verified" chip
+ Disconnect button, or a Connect button.

## Connect flow (modal, two steps)

1. **Redirecting** — spinner, "Redirecting to {platform}… Establishing a secure authorization
   session." (fake ~1.3s latency in the prototype; a real OAuth redirect in production).
2. **Scope grant** — lists three requested scopes (read page/profile metadata, publish posts,
   read insights) with a Cancel / Grant scope choice. Granting flips the connection on and shows a
   confirmation toast.

The prototype explicitly notes this is UI scaffolding with no real OAuth round-trip — production
wiring is a backend concern documented in
[`backend/PlatformConnectionController.md`](../backend/PlatformConnectionController.md).

## Disconnect

Immediate — flips the connection off, shows a toast, and (new rule, not in the prototype) removes
that platform from Content Studio's in-progress "Publish to" selection if it was selected. Historical
performance data for that platform is retained, not deleted.

## State

Shared across the app (not local to this screen) — Content Studio's publish picker reads the same
`connections` map, so connecting/disconnecting here must be visible there without a page reload.

## API calls

| Call | When | Endpoint |
|---|---|---|
| connect | Grant scope | see [`backend/PlatformConnectionController.md`](../backend/PlatformConnectionController.md) — **specified, not yet implemented** |
| disconnect | Disconnect button | same |
