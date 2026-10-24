/** Forecast market ids ("korea") as the country names used elsewhere in the app. */
const MARKET_NAMES: Record<string, string> = {
  korea: 'South Korea',
  japan: 'Japan',
  usa: 'United States',
};

export function marketName(market: string): string {
  return MARKET_NAMES[market.trim().toLowerCase()] ?? market;
}
