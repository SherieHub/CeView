/**
 * The single place the app leaves for an OAuth consent screen. A separate module so tests can
 * mock it — jsdom cannot navigate.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
