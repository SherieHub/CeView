/**
 * Product events for the landing showcase and the public demo.
 *
 * CeView has no analytics provider, and the Privacy Notice promises no
 * third-party analytics cookies — so this collects nothing by itself. Each
 * event is dispatched as a `ceview:analytics` window event and, if a tag
 * manager has put a `dataLayer` on the page, pushed onto it. Wiring a
 * provider later means listening for that event; no call site changes.
 *
 * Events carry only the event name and a few fixed labels (a feature id, a
 * step number) — never typed text, captions or anything about the visitor.
 */
export type AnalyticsEvent =
  | 'showcase_feature_selected'
  | 'showcase_step_completed'
  | 'demo_opened'
  | 'demo_guided_tour_started'
  | 'demo_guided_tour_completed'
  | 'demo_feature_explored'
  | 'demo_reset'
  | 'demo_request_cta_clicked'
  | 'request_demo_submitted';

export type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === 'undefined') return;
  const payload = { event, ...props };
  try {
    window.dataLayer?.push(payload);
    window.dispatchEvent(new CustomEvent('ceview:analytics', { detail: payload }));
  } catch {
    // Analytics must never break the page.
  }
  if (import.meta.env.DEV) console.debug('[analytics]', payload);
}
