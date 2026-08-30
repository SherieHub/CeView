/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 * Prototype reference: ui-ux-prototype.html:2400-2420
 *
 * One surge alert. Replaces the legacy TrendAlertCard.
 *
 * Two deliberate departures from the prototype:
 *
 * 1. Unread is signalled ONCE. The prototype marked it with both a gold left
 *    border and a pulsing dot, while selected took a navy ring plus a gold
 *    trailing rule — so an unread AND selected card wanted two competing left
 *    borders in the same colour. Unread is now a coral dot only, which frees
 *    the left edge for selection.
 * 2. Selection uses the same idiom as the sidebar's active row and the wizard's
 *    current step: a 3px mint left border. One selection language app-wide.
 *
 * It is also a real disclosure — aria-expanded/aria-controls point at the
 * markets panel it opens. The prototype had no ARIA at all.
 */
import { ArrowRight, ChevronUp, MapPin, Tag, TrendingUp, Zap } from 'lucide-react';
import { isSurge } from '@/types';
import type { DemandAlert } from '@/types';

interface AlertCardProps {
  alert: DemandAlert;
  isRead: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function AlertCard({ alert, isRead, isSelected, onSelect }: AlertCardProps) {
  return (
    <button
      type="button"
      className="alert-card"
      data-selected={isSelected}
      aria-expanded={isSelected}
      aria-controls="dash-markets-panel"
      onClick={() => onSelect(alert.id)}
    >
      <div className="alert-top">
        {!isRead && <span className="alert-dot" aria-hidden="true" />}
        <span className="text-meta">{alert.date}</span>
        {!isRead && <span className="sr">Unread</span>}
        {isSurge(alert) && (
          <span className="chip chip--critical">
            <Zap aria-hidden="true" /> Surge
          </span>
        )}
      </div>

      <h3 className="heading-sm">{alert.title}</h3>
      <p className="body-sm">{alert.alertMessage}</p>

      <div className="chip-row mt-3">
        <span className="chip">
          <MapPin aria-hidden="true" /> {alert.market}
        </span>
        <span className="chip">
          <Tag aria-hidden="true" /> {alert.category}
        </span>
        <span className="chip">
          <TrendingUp aria-hidden="true" /> {alert.trend}
        </span>
      </div>

      <span className="alert-cta">
        {isSelected ? 'Hide target markets' : 'View target markets'}
        {isSelected ? <ChevronUp size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}
      </span>
    </button>
  );
}
