import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import CalendarView from './CalendarView';
import { monthWeeks, toEntry } from './calendarModel';
import type { PublishedPost } from '../../../types';

const base = { reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] };
const POSTS: PublishedPost[] = [
  { ...base, id: 's1', date: '2026-10-21', platform: 'instagram', caption: 'Sardine season is here.\nMore below.', status: 'scheduled', scheduledFor: '2026-10-21T09:00' },
  { ...base, id: 's2', date: '2026-11-03', platform: 'facebook', caption: 'November mornings.', status: 'scheduled', scheduledFor: '2026-11-03T08:00' },
  { ...base, id: 'p1', date: '2026-10-06', platform: 'tiktok', caption: 'Golden hour.', status: 'published', reach: 27400, likes: 2310, engagementRate: 11.2 },
];
const NOW = new Date(2026, 9, 17, 12, 0);

function renderCalendar(posts = POSTS) {
  return render(
    <MemoryRouter>
      <OverlayStackProvider>
        <CalendarView posts={posts} now={NOW} />
      </OverlayStackProvider>
    </MemoryRouter>,
  );
}

describe('calendarModel', () => {
  it('places a scheduled post on its scheduled day, titled by its first line', () => {
    const e = toEntry(POSTS[0]);
    expect(e.day).toBe('2026-10-21');
    expect(e.title).toBe('Sardine season is here.');
    expect(e.time).not.toBeNull();
  });

  it('builds only the weeks a month needs', () => {
    expect(monthWeeks(2026, 9)).toHaveLength(5); // Oct 2026 starts on a Thursday
    expect(monthWeeks(2026, 7)).toHaveLength(6); // Aug 2026 starts on a Saturday
  });
});

describe('CalendarView', () => {
  it('shows scheduled and published posts on their days, and counts what is upcoming', () => {
    renderCalendar();
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wednesday, October 21: 1 post/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tuesday, October 6: 1 post/ })).toBeInTheDocument();
    expect(screen.getByText('Scheduled', { selector: '.cal-stat-label' }).nextElementSibling).toHaveTextContent('2 upcoming');
  });

  it('lists every upcoming scheduled post under Up next, across months', () => {
    renderCalendar();
    const rail = screen.getByRole('complementary', { name: 'Up next' });
    expect(within(rail).getAllByRole('listitem')).toHaveLength(2);
    expect(within(rail).getByText('November mornings.')).toBeInTheDocument();
  });

  it('opens a day to show its posts, with metrics for published ones', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: /Tuesday, October 6/ }));
    const dialog = screen.getByRole('dialog', { name: /Tuesday, October 6/ });
    expect(within(dialog).getByText(/27k reach/)).toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: /^Published/ }));
    const grid = screen.getByRole('grid');
    expect(within(grid).queryByRole('button', { name: /October 21/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /October 6: 1 post/ })).toBeInTheDocument();
  });

  it('moves between months', async () => {
    renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tuesday, November 3: 1 post/ })).toBeInTheDocument();
  });

  it('says so when nothing is scheduled', () => {
    renderCalendar([POSTS[2]]);
    expect(screen.getByText(/Nothing scheduled yet/)).toBeInTheDocument();
  });
});
