/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 * DoD: covers all four feed-owned states against a mixed fixture set.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AlertFeed from './AlertFeed';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import type { AlertFeedSlotProps } from './dashboardTypes';

const CATEGORIES = ['Accommodation & Staycation', 'Culinary & Gastronomy'];
const MINE = MOCK_NOTIFICATIONS.filter((a) => CATEGORIES.includes(a.category));

function renderFeed(overrides: Partial<AlertFeedSlotProps> = {}) {
  const props: AlertFeedSlotProps = {
    mode: 'normal',
    alerts: MINE,
    totalForProfile: MINE.length,
    categories: CATEGORIES,
    selectedAlertId: null,
    isRead: (id) => MOCK_NOTIFICATIONS.find((a) => a.id === id)?.isRead ?? false,
    onSelect: vi.fn(),
    filter: 'all',
    onFilterChange: vi.fn(),
    unreadCount: 2,
    surgeCount: 2,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AlertFeed {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('AlertFeed — states', () => {
  it('renders skeletons and marks itself busy while loading', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertFeed
          {...({
            mode: 'loading',
            alerts: [],
            totalForProfile: 0,
            categories: CATEGORIES,
            selectedAlertId: null,
            isRead: () => false,
            onSelect: vi.fn(),
            filter: 'all',
            onFilterChange: vi.fn(),
            unreadCount: 0,
            surgeCount: 0,
          } satisfies AlertFeedSlotProps)}
        />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.skel')).toHaveLength(3);
    expect(screen.getByLabelText('Surge alerts')).toHaveAttribute('aria-busy', 'true');
  });

  it('says no forecast has run when there are no alerts at all', () => {
    renderFeed({ mode: 'empty', alerts: [], totalForProfile: 0 });
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  // Distinct from the above: forecasts exist, they just do not match this
  // operator. Different remedy, so it gets a route to the fix.
  it('names the categories and offers a way to widen them when nothing matches', () => {
    renderFeed({ alerts: [], totalForProfile: 0 });

    expect(screen.getByText('No surge alerts for your categories yet')).toBeInTheDocument();
    expect(screen.getByText(/Accommodation & Staycation, Culinary & Gastronomy/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit business categories/ })).toHaveAttribute(
      'href',
      '/settings/profile',
    );
  });

  it('renders one card per alert when populated', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertFeed
          {...({
            mode: 'normal',
            alerts: MINE,
            totalForProfile: MINE.length,
            categories: CATEGORIES,
            selectedAlertId: null,
            isRead: () => false,
            onSelect: vi.fn(),
            filter: 'all',
            onFilterChange: vi.fn(),
            unreadCount: 2,
            surgeCount: 2,
          } satisfies AlertFeedSlotProps)}
        />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.alert-card')).toHaveLength(MINE.length);
  });

  // A filtered-to-nothing feed is recoverable in one click, so it must not
  // reuse the "you have no alerts" copy.
  it('distinguishes a filter hiding everything from having no alerts', () => {
    renderFeed({ alerts: [], totalForProfile: 3, filter: 'unread' });

    expect(screen.getByText('Nothing unread')).toBeInTheDocument();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });
});

describe('AlertFeed — interaction', () => {
  it('reports the clicked alert', async () => {
    const user = userEvent.setup();
    const props = renderFeed();

    await user.click(screen.getByText(MINE[0].title));

    expect(props.onSelect).toHaveBeenCalledWith(MINE[0].id);
  });

  it('exposes the selected card as an expanded disclosure', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertFeed
          {...({
            mode: 'normal',
            alerts: MINE,
            totalForProfile: MINE.length,
            categories: CATEGORIES,
            selectedAlertId: MINE[0].id,
            isRead: () => true,
            onSelect: vi.fn(),
            filter: 'all',
            onFilterChange: vi.fn(),
            unreadCount: 0,
            surgeCount: 2,
          } satisfies AlertFeedSlotProps)}
        />
      </MemoryRouter>,
    );

    const first = container.querySelector('.alert-card')!;
    expect(first).toHaveAttribute('data-selected', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Hide target markets')).toHaveLength(1);
  });

  it('shows the unread dot only on unread cards', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertFeed
          {...({
            mode: 'normal',
            alerts: MINE,
            totalForProfile: MINE.length,
            categories: CATEGORIES,
            selectedAlertId: null,
            isRead: (id) => id !== MINE[0].id,
            onSelect: vi.fn(),
            filter: 'all',
            onFilterChange: vi.fn(),
            unreadCount: 1,
            surgeCount: 2,
          } satisfies AlertFeedSlotProps)}
        />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.alert-dot')).toHaveLength(1);
  });

  it('drives the filter through aria-pressed segments', async () => {
    const user = userEvent.setup();
    const props = renderFeed();

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Surges (2)' }));

    expect(props.onFilterChange).toHaveBeenCalledWith('surge');
  });
});
