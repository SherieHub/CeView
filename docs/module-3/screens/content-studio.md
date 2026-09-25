# Screen — Content Studio

**Route:** `/content` · **Module:** 3 (Content Studio) · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:2668–3089`](../../../ui-ux-prototype.html#L2668)
(`renderContent` and the `C()`/`cs*` functions — this is **v1**, `screen-content`/`renderContent`,
not the v2 per-platform pipeline at `screen-content2`; see "Which prototype version" below).

**Component:** `components/module-3/3.1-content-studio/ContentStudioView.tsx` (existing, substantially
rewritten, not replaced).

## Which prototype version

The prototype ships two Content Studios: `screen-content` (v1 — one shared staged caption approved
per-platform, published together) and `screen-content2` (v2 — a per-platform pipeline with
connection-gated tabs, one caption/preview/audit per platform, written specifically to fix three gaps
in v1). **This screen builds v1.** v2 and `APP_STATE.content2` are a superseded draft: not built, not
referenced by any other doc. The one gap from v1 worth fixing is ported in separately (see "Publish
gating" below) rather than adopting v2's whole structure.

## Layout

Two-column grid (`cs-grid`). Left: AI copywriting matrix card, then a visual direction card. Right:
publish composer card, then compliance audit card. Below both: content board (draft/published list).

## State

```
content: {
  platform: 'instagram'|'tiktok'|'facebook'|'naver',
  approved: { [platform]: optionIndex },
  approvedText: { [platform]: string },
  edits: { "platform-idx": string },       // inline caption edits, keyed per option
  staged: string,                          // the composer's current text
  media: { url, name, size } | null,
  publishPlatforms: string[],              // platforms selected for this publish action
  toggles: { visibility: bool, comments: bool, paid: bool },
  agreed: boolean,
  omcs: OmcsAuditResultDTO | null,
  auditing: boolean
}
```

## Left column

### AI copywriting matrix (`AIContentMatrixPanel`)

Platform tabs — Instagram, TikTok, Facebook, Naver — each showing a gold dot if that platform already
has an approved option. Per platform, three archetype-driven caption options (Witty/Trend-Conscious,
Formal/Educational, Storytelling/Immersive), **except Naver**, which shows exactly two curated
long-form Korean editorial templates plus an info banner explaining why ("Naver rewards editorial
depth, which the three-platform model cannot produce reliably").

Each option card: editable textarea (inline edits persist per option, independent of other options),
live character counter against `PLATFORM_CHAR_LIMITS` (Instagram 2200 / TikTok 300 / Facebook 500 /
Naver 5000 — turns red over limit), a "Why this caption" disclosure revealing five metadata
dimensions (core business context, market & cultural localization, psychological elements, creative
tone & atmosphere, platform architecture constraints), and an Approve button. Approving stages that
text into the composer's `staged` field and clears any existing audit result (a new caption
invalidates the last audit).

### Visual direction (`VisualDirectionBoard`)

Numbered shot-list guidance specific to the active platform tab (e.g. Instagram: "aesthetic mood
shot, warm low-contrast filter, 4:5 portrait ratio…"; TikTok: "9:16 vertical, hook in first 0.8s…").

## Right column

### Publish composer (new component, or a rewrite of `MediaCaptionManager`/`DistributionPanel`)

- Staged caption textarea (editable directly, independent of the option cards — an operator can write
  from scratch instead of approving an option).
- Pubmat dropzone — drag or click, PNG/JPG/WEBP up to 20MB, preview with remove.
- **Publish-to platform picker** — one toggle per platform. **Deviation from the prototype**:
  platforms not connected in [Settings → Platforms](settings-platforms.md) render disabled with an
  inline "Connect" affordance instead of being freely selectable. The prototype's v1 lets an operator
  select any platform regardless of connection state; this was one of the three gaps v2 existed to
  fix, and it's the only one being kept from v2's design.
- Three post-config switches: public visibility, allow comments, paid promotion.
- Authorization checkbox — checking it (with a caption staged and media uploaded) triggers the
  six-step OMCS compliance audit.
- Publish button — disabled until every gate below passes; the tooltip always shows the **first**
  unmet reason, in this order:
  1. Caption staged
  2. Media uploaded
  3. ≥1 platform selected **and every selected platform is connected**
  4. Agreement checked
  5. Audit not still running
  6. Audit has run
  7. Audit status is `Pass`

### Ad URL block (`AdUrlBlock`)

For a Content Studio session opened from a real demand-window alert, the composer loads the
authenticated operator's attribution links and selects the row with the same stable window tuple:
category, target market, and window start. It deliberately does not treat `demandAlertId` as a
durable key because forecasting refreshes alert rows while a link may already be live in a paid ad.

The block renders three strings distinctly and in this order:

1. the bare redirect link, visually secondary, for link-in-bio or other non-creative-specific use;
2. the Meta macro URL, with its own copy button; and
3. the TikTok macro URL, with its own copy button.

Each copy button writes its own complete string to the clipboard. The platform rows are visually
primary, and the block explicitly tells the operator to use the ad URL in Ads Manager's URL
parameters field rather than in a caption. It also states that Instagram captions do not linkify.

The adjacent destination control switches the same link between the operator's absolute HTTP(S)
page and CeView's hosted booking form. The backend response replaces the displayed link state after
save. Unsafe or relative URLs produce a visible error and are not submitted.

If the selected content target has no demand-window timestamp, or no link matches the window tuple,
the block renders nothing. Ad-hoc generation must not show a blank or disabled attribution surface.
Operator instructions, including the requirement to preserve Meta's double braces, live in
[`LINK_ATTRIBUTION_SETUP.md`](../../../LINK_ATTRIBUTION_SETUP.md).

### Compliance audit (`CompliancePanel`, wraps existing `ComplianceGauge`)

- **Not run yet** — empty state prompting to stage a caption, upload a pubmat, and tick the agreement.
- **Auditing** — six-step checklist animates in sequence (~420ms/step): loading caption + pubmat →
  comparing pubmat to business profile → scoring the 7-dimension visual rubric → checking caption↔
  image consistency → computing OMCS composite → resolving pass/fail.
- **Complete** — OMCS radial gauge (color: green ≥80, gold ≥60, red below), pass/fail chip at
  threshold 70, three weighted sub-scores as progress bars (profile semantic × 0.35, recommendations
  × picture × 0.45, pubmat consistency × 0.20 — the formula is shown verbatim under the gauge), a
  7-row rubric table (visual↔business context match, visual intent consistency, tone↔visual mood
  alignment, psychological strategy support, target audience fit, platform suitability, attribute
  coverage consistency), a feedback banner, and a consistency-explanation paragraph. A "Re-run" button
  appears once a result exists.

## Below both columns — content board

All / Draft / Published tabs over the shared post list. Each card: platform dot, status chip, date,
caption excerpt, and (if published with reach data) a small reach/likes footer.

## Publishing

Publishing appends one post per selected platform to the shared post store (today's date,
`status: 'published'`), then clears the composer's transient state (`publishPlatforms`, `agreed`,
`omcs`) while leaving each platform's approved caption intact. This store is what
[Calendar](calendar.md) and [Performance](../../module-4/screens/performance.md) read.

## API calls

| Call | When | Endpoint |
|---|---|---|
| content generation (on entry, scoped to the targeted market) | screen mount | `POST /api/content/generate` |
| attribution links | alert-derived target changes | `GET /api/attribution/links` |
| destination mode | operator saves the control beside the URLs | `PATCH /api/attribution/links/{linkId}` |
| `apiClient` creative direction | visual direction card | `POST /api/creative-direction/generate/{profileId}` |
| compliance audit | agreement checkbox ticked | `POST /api/compliance/evaluate` (multipart, with pubmat) |
| publish | Publish button | see [`backend/PublishingController.md`](../backend/PublishingController.md) — **specified, not yet implemented** |

## Backend requirement

Publishing itself (`csPublish`) has no backend today — see
[`backend/PublishingController.md`](../backend/PublishingController.md) and
[`backend/schema-delta.md`](../backend/schema-delta.md).
