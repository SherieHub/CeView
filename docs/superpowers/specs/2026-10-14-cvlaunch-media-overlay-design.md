# CVLAUNCH Media Overlay

**Date:** 2026-10-14  
**Status:** Approved design; awaiting implementation planning  
**Module:** 3 (Content Studio), consuming the Module 4 CVLAUNCH voucher

## Goal

Let an operator optionally embed any active promotion voucher in a photo asset
while composing content. The overlay is not a preview-only decoration: the
exported and published image includes it.

## Operator experience

Media Creation gains an **“Add voucher to image”** toggle and a voucher picker.
The toggle is off by default and is shown only when the current business has
an active voucher. CVLAUNCH is selected by default when available.

When on, `MediaPreviewCard` renders a bottom-right badge with:

```
PHP {discount} OFF
Use code: {voucher code}
{remaining} bookings remaining
```

The badge sits inside a 4%-of-image safe margin, has sufficient contrast, and
scales its typography from the source image dimensions. It does not attempt
subject detection or automatic repositioning in this release. Turning the
toggle off removes the overlay from the preview and the saved output.

## Asset generation

The frontend uses an off-screen canvas to compose the uploaded image and badge
at the original image dimensions. It replaces the staged `imageDataUrl` with
the resulting PNG data URL only when the operator enables the overlay; the
unmodified upload remains in memory so disabling it restores the exact source
asset. The composed data URL is the one passed to the existing OMCS audit and
the publishing draft, ensuring preview, audit, and published media agree.

No image-generation model, external image host, or backend image-processing
endpoint is added. Canvas export errors leave the original asset untouched and
show an actionable error beside the toggle.

## Data and validity

The toggle fetches `GET /api/attribution/vouchers` through the existing API
client and renders the selected voucher's server-provided terms. The voucher
copy is not editable free text. When a voucher is exhausted or expired, it is
not selectable and any active overlay is removed before the asset can be
published.

## Tests

- A voucher-active upload shows the toggle, initially off.
- Enabling it produces a canvas asset with a bottom-right overlay and routes
  that asset to audit/publishing.
- Disabling it restores the original source data URL.
- No active voucher means no toggle.
- Canvas export failure preserves the original upload and reports an error.

## Out of scope

Manual badge placement, custom colours/copy, percentage discounts, video
overlays, subject-aware placement, and server-side image compositing.
