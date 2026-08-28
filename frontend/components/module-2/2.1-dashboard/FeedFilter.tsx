/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 *
 * All / Unread / Surges segmented filter over the operator's own alerts.
 *
 * Not in the prototype. It exists because the prototype's "N unread" chip was
 * pure decoration — with alerts spread across several categories there was no
 * way to isolate the confirmed surges, which are the only ones that carry a
 * deadline. The count is retained, now as a live segment that also does
 * something.
 *
 * Purely client-side over data already loaded; no new request.
 */
import type { FeedFilter as FeedFilterValue } from './useDashboardState';

interface FeedFilterProps {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
  unreadCount: number;
  surgeCount: number;
}

export default function FeedFilter({ value, onChange, unreadCount, surgeCount }: FeedFilterProps) {
  const options: { id: FeedFilterValue; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'surge', label: 'Surges', count: surgeCount },
  ];

  return (
    <div className="seg" role="group" aria-label="Filter alerts">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count != null && ` (${option.count})`}
        </button>
      ))}
    </div>
  );
}
