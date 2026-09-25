# Link Attribution — Operator Setup & Testing Guide

This guide explains which CeView link to paste into a Meta or TikTok ad so the
Performance screen can show which **ad creative** produced a booking.

**What this enables:** CeView records the ad, ad set, and campaign identifiers
that the platform adds when someone clicks. A booking linked to that click can
then be reported against the specific creative that produced it.

**What this does not do:** it does not publish ads, change an ad account, or see
bookings that happen through Messenger, phone calls, or walk-ins. Keep using the
campaign promo code for those offline paths. Link attribution is one evidence
source, not a count of every booking the campaign influenced.

---

## 1. Choose the right string

Content Studio shows three different strings in its **Ad URL** block. They are
not interchangeable.

| String | Put it here | What it is for |
|---|---|---|
| **Bare link** | A link-in-bio, a link-friendly caption, or the ad CTA's destination field | Sends visitors through CeView, but cannot identify a paid-ad creative by itself. |
| **Meta ad URL** | Meta Ads Manager's **URL parameters** field | Carries Meta's campaign, ad set, and ad ID macros so CeView can identify the creative. |
| **TikTok ad URL** | TikTok Ads Manager's equivalent URL-parameter/tracking field | Carries TikTok's campaign, ad group, and creative ID macros. |

For a paid ad, copy the platform-specific **ad URL**, not the bare link. The Ad
URL block makes the Meta and TikTok rows visually primary and gives each row its
own copy button.

> Paste the platform ad URL into the ad's URL parameters field in Ads Manager —
> not into the caption.

Instagram captions do not turn URLs into tappable links. For Instagram, use the
ad's CTA button or put the bare link in the account's link-in-bio.

---

## 2. Keep Meta's braces intact

Meta replaces its macros when the ad is clicked. The Meta string must still
contain literal double braces after you paste it:

```text
cmp={{campaign.id}}&set={{adset.id}}&ad={{ad.id}}
```

If the ad ID looks like this, it has been URL-encoded and will not be replaced:

```text
ad=%7B%7Bad.id%7D%7D
```

Re-copy the Meta ad URL from Content Studio. Do not run it through a URL encoder
or manually replace the braces. An encoded macro still redirects, but every
click becomes untagged, so the failure is otherwise silent.

TikTok's string must likewise keep its macros as written, including
`__CAMPAIGN_ID__`, `__AID__`, and `__CID__`.

---

## 3. Choose where visitors land

The destination control sits beside the three URLs in Content Studio. It has
two modes in operator language:

- **Send visitors to my own page** — enter a complete `http://` or `https://`
  booking or enquiry URL. Relative paths and `javascript:` URLs are rejected.
- **Use CeView's booking form** — CeView hosts the enquiry form. No destination
  URL is needed.

Changing the destination does not change the three copyable strings or the
short link already running in an ad. Future clicks simply continue through the
same CeView redirect and land at the newly selected destination.

---

## 4. Check that attribution is working

After the first real ad clicks, open **Performance** and inspect the
per-creative link-attribution rows. Working platform macros produce separate
rows such as `Ad 120214`, each with its own clicks, bookings, and revenue.

If all traffic appears in one **Untagged** row, check these first:

1. The paid ad uses the Meta or TikTok ad URL, not the bare link.
2. Meta's `{{ad.id}}` braces are still literal, not `%7B` / `%7D`.
3. The URL was placed in the ad's URL-parameter/tracking field.

An untagged row is not discarded: it can represent an organic visit or an ad
whose macros were missing. It is shown honestly because those clicks are still
real reach, even though CeView cannot name the creative.

---

## 5. Quick copy test

Before launching spend, copy all three buttons into a plain-text editor.
Confirm that:

- the three strings are different;
- the Meta string contains `{{ad.id}}` exactly;
- the TikTok string contains `__CID__` exactly; and
- the ad uses its platform-specific string.

This check matters because a bare or encoded link still opens successfully.
Without it, creative attribution can degrade silently while the ad appears to
work normally.
