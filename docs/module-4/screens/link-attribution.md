# Screen — Link Attribution

**Route:** `/performance` (embedded panel) and `/enquiry` (public, upcoming in Track 4)
**Module:** 4 (Campaign Analytics & Reporting)

## Link-Attributed Evidence Panel

On the Performance screen, the Link Attribution panel presents tracked click and conversion data for a specific campaign link. 

### Key Features
- **Scope**: The data is scoped strictly to the selected campaign link within its time window (`windowStart` to `windowEnd`). It authorizes access by ensuring the link belongs to the currently authenticated business profile.
- **Creative Grouping**: Conversions, revenue, and clicks are grouped by `externalAdId`.
- **Organic / Untagged**: Any traffic arriving without a creative ID (or with a blank one) is grouped into a designated "Organic / untagged" bucket. An untagged-only diagnostic message advises checking ad setup if expected IDs are missing.
- **Zero-Revenue Conversions**: Enquiries that have not yet translated to paid bookings are still counted as conversions (with `revenue` = 0). The UI clarifies that conversions include enquiries and operator-matched bookings.
- **Inventory Limitation**: Only creatives that have registered at least one click are displayed. The system does not infer or list missing creatives from the ad platform's inventory.
- **States**: Includes loading, error (with retry capability), empty ("No tracked campaign links yet" or "No tracked clicks yet"), and fully populated states.

### Standalone Picker Integration

The `ClickMatchStep` component allows operators to manually match an unconverted click to a new booking. 
- **Controlled Component**: It takes the selected link ID and its time window as props.
- **Behavior**: It fetches unconverted clicks (only from the selected link and window) and displays them as radio options. It clears stale selections when the window or candidates change.
- **Fallback**: Includes a "None of these" option, leaving the manual booking path unchanged.

## Public Enquiry Page (Track 4)

*Note: The public enquiry endpoint and page are scheduled for Track 4 and are not yet implemented.*

Once completed, a traveler clicking on a tracked link will be redirected to the hosted enquiry page. Submitting the form will register an enquiry event tied to the original click, which will subsequently appear as a conversion in the Link Attribution panel.
