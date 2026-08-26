/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 * Prototype reference: ui-ux-prototype.html:2385-2420, 2496-2515
 *
 * The feed and the four states it owns. `ai-down` and the refresh action belong
 * to sibling components (AiStatusBanner / RefreshForecastButton).
 *
 * Note the two distinct empties, which the prototype was careful about and
 * which are easy to collapse into one by accident:
 *   - `empty`            — no forecast has ever run for this operator
 *   - myAlerts.length 0  — forecasts exist, none match the operator's categories
 * Different cause, different remedy, different copy.
 */
import { BellOff, Tag, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import AlertCard from './AlertCard';
import FeedFilter from './FeedFilter';
import type { AlertFeedSlotProps } from './dashboardTypes';

export default function AlertFeed({
  mode,
  alerts,
  totalForProfile,
  categories,
  selectedAlertId,
  isRead,
  onSelect,
  filter,
  onFilterChange,
  unreadCount,
  surgeCount,
}: AlertFeedSlotProps) {
  if (mode === 'loading') {
    return (
      <section className="dash-feed" aria-busy="true" aria-label="Surge Alerts">
        <h2 className="heading-md mb-3">Surge Alerts</h2>
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" style={{ height: 150 }} />
          ))}
        </div>
      </section>
    );
  }

  if (mode === 'empty') {
    return (
      <section className="dash-feed" aria-label="Surge Alerts">
        <h2 className="heading-md mb-3">Surge Alerts</h2>
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <BellOff aria-hidden="true" />
            </div>
            <h3 className="heading-sm">No notifications yet</h3>
            <p className="body-sm">
              Market trend data will appear here once your profile has been analysed and the first
              forecast run completes.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (totalForProfile === 0) {
    return (
      <section className="dash-feed" aria-label="Surge Alerts">
        <h2 className="heading-md mb-3">Surge Alerts</h2>
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <Tag aria-hidden="true" />
            </div>
            <h3 className="heading-sm">No surge alerts for your categories yet</h3>
            <p className="body-sm">
              Nothing is currently trending for {categories.join(', ') || 'your business categories'}.
              Add another category to widen your coverage.
            </p>
            {/* The prototype only pointed at Settings in prose. A real control
                is one click instead of a hunt through the nav. */}
            <Link to="/settings/profile" className="btn-primary mt-3">
              Edit business categories
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-feed" aria-label="Surge Alerts">
      <div className="feed-head">
        <h2 className="heading-md">Surge Alerts</h2>
        <FeedFilter
          value={filter}
          onChange={onFilterChange}
          unreadCount={unreadCount}
          surgeCount={surgeCount}
        />
      </div>

      {alerts.length === 0 ? (
        // The filter hid everything — recoverable in one click, so this is a
        // lighter treatment than the two empties above.
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <Inbox aria-hidden="true" />
            </div>
            <h3 className="heading-sm">
              {filter === 'unread' ? 'Nothing unread' : 'No confirmed surges right now'}
            </h3>
            <p className="body-sm">
              {filter === 'unread'
                ? "You've read every alert for your categories."
                : 'None of your current alerts have broken the surge threshold.'}{' '}
              Switch back to All to see them.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isRead={isRead(alert.id)}
              isSelected={alert.id === selectedAlertId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
