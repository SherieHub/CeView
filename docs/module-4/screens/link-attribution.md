# Screen — Link Attribution

**Route:** `/performance` (embedded panel). The public enquiry page's route is set by Track 4 and is
not in the repository yet.
**Module:** 4 (Campaign Analytics & Reporting)

## Link-Attributed Evidence Panel

On the Performance screen, the Link Attribution panel presents tracked click and conversion data for a specific campaign link. 

### Key Features
- **Scope**: The data is scoped strictly to the selected campaign link within its time window (`windowStart` to `windowEnd`). It authorizes access by ensuring the link belongs to the currently authenticated business profile.
- **Creative Grouping**: Conversions, revenue, and clicks are grouped by `externalAdId`.
- **Organic / Untagged**: Any traffic arriving without a creative ID (or with a blank one) is grouped into a designated "Organic / untagged" bucket. An untagged-only diagnostic message advises checking ad setup if expected IDs are missing.
- **Zero-Revenue Conversions**: Enquiries that have not yet translated to paid bookings are still counted as conversions (with `revenue` = 0). The UI clarifies that conversions include enquiries and operator-matched bookings.
- **Inventory Limitation**: The backend only knows creatives that have registered at least one in-window click. The table still shows any zero-click row it is given. The system does not infer or list missing creatives from the ad platform's inventory.
- **States**: Includes loading, error (with retry capability), empty ("No tracked campaign links yet" or "No tracked clicks yet"), and fully populated states.

### Standalone Picker Integration

The `ClickMatchStep` component allows operators to manually match an unconverted click to a new booking. 
- **Controlled Component**: It takes the selected link ID and its time window as props (`linkId`, `from`, `to`, `value`, `onChange`).
- **Not yet mounted**: its parent, the promo-code `LogBookingAction`, and the redemption write API are not implemented yet. When they land, the parent sends a non-null `value` as the redemption's `clickId`, which makes it a `source='LINK'` row.
- **Behavior**: It fetches unconverted clicks (only from the selected link and window) and displays them as radio options. It clears stale selections when the window or candidates change.
- **Fallback**: Includes a "None of these" option, leaving the manual booking path unchanged.

## Public Enquiry Page (Track 4)

The public enquiry page belongs to Track 4 and is not implemented yet. No operator logs into it, but it is still a Module 4 surface.

When it lands, a traveller clicking on a tracked link will be redirected to the hosted enquiry page. Submitting the form will register an enquiry event tied to the original click, which will subsequently appear as a conversion in the Link Attribution panel.
