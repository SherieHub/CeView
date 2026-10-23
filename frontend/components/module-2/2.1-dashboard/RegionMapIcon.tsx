/**
 * A Philippine region's silhouette (see regionShapes.ts), in the slot the
 * international rows use for a flag. Unknown regions get a map pin.
 * Decorative: the region name always sits beside it.
 */
import { MapPin } from 'lucide-react';
import { REGION_SHAPES } from './regionShapes';

export default function RegionMapIcon({ name }: { name: string }) {
  const d = REGION_SHAPES[name];
  return (
    <span className="mkt-flag region-map" aria-hidden="true">
      {d ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d={d} />
        </svg>
      ) : (
        <MapPin size={16} strokeWidth={1.75} />
      )}
    </span>
  );
}
