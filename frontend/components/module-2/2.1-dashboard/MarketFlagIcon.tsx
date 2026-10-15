/**
 * A source market's flag, by market name. Flags are SVGs from flag-icons
 * (MIT), bundled locally — never emoji. Unknown markets get a globe.
 * Decorative: the market name always sits beside it.
 */
import { Globe } from 'lucide-react';
import au from 'flag-icons/flags/4x3/au.svg';
import cn from 'flag-icons/flags/4x3/cn.svg';
import hk from 'flag-icons/flags/4x3/hk.svg';
import jp from 'flag-icons/flags/4x3/jp.svg';
import kr from 'flag-icons/flags/4x3/kr.svg';
import ph from 'flag-icons/flags/4x3/ph.svg';
import sg from 'flag-icons/flags/4x3/sg.svg';
import tw from 'flag-icons/flags/4x3/tw.svg';
import us from 'flag-icons/flags/4x3/us.svg';

const FLAGS: Record<string, string> = {
  australia: au,
  china: cn,
  'hong kong': hk,
  japan: jp,
  'south korea': kr,
  korea: kr,
  philippines: ph,
  domestic: ph,
  singapore: sg,
  taiwan: tw,
  'united states': us,
  usa: us,
};

export default function MarketFlagIcon({ name }: { name: string }) {
  const src = FLAGS[name.trim().toLowerCase()];
  return (
    <span className="mkt-flag" aria-hidden="true">
      {src ? <img src={src} alt="" width={28} height={21} /> : <Globe size={16} strokeWidth={1.75} />}
    </span>
  );
}
