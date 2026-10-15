/**
 * A source market with its marker: a flag for South Korea, Japan, the United
 * States and the Philippines (Domestic), a map pin for Local. Flags are
 * SVGs from flag-icons (MIT), bundled locally — never emoji.
 */
import { MapPin } from 'lucide-react';
import krFlag from 'flag-icons/flags/4x3/kr.svg';
import jpFlag from 'flag-icons/flags/4x3/jp.svg';
import usFlag from 'flag-icons/flags/4x3/us.svg';
import phFlag from 'flag-icons/flags/4x3/ph.svg';
import { FACTS, type MarketKey } from '../../../content/landing';

const FLAGS: Partial<Record<MarketKey, string>> = { KR: krFlag, JP: jpFlag, US: usFlag, domestic: phFlag };

export default function MarketFlag({
  market,
  showDetail = false,
  name,
  detail,
  size = 'md',
  className,
}: {
  market: MarketKey;
  /** Show "Cebu & nearby provinces", "Other Philippine regions", … under the name. */
  showDetail?: boolean;
  /** Replace the market's name from FACTS. */
  name?: string;
  /** Replace the line under the name; shown whenever it is set. */
  detail?: string;
  /** md: 24px flag; lg: 28px. */
  size?: 'md' | 'lg';
  className?: string;
}) {
  const info = FACTS.markets.find((m) => m.key === market)!;
  const flag = FLAGS[market];
  const flagW = size === 'lg' ? 28 : 24;
  const sub = detail ?? (showDetail ? info.detail : undefined);
  return (
    <span className={`cv-market${className ? ` ${className}` : ''}`} data-size={size === 'lg' ? 'lg' : undefined}>
      {flag ? (
        <span className="cv-market-flag" aria-hidden="true">
          <img src={flag} alt="" width={flagW} height={(flagW * 3) / 4} />
        </span>
      ) : (
        <span className="cv-market-flag" data-kind="icon" aria-hidden="true">
          <MapPin size={size === 'lg' ? 22 : 18} strokeWidth={1.75} />
        </span>
      )}
      <span className="cv-market-text">
        <span className="cv-market-name">{name ?? info.name}</span>
        {sub && <span className="cv-market-detail">{sub}</span>}
      </span>
    </span>
  );
}
