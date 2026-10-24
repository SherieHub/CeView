/**
 * Content Calendar — every post in the shared post store, on the day it goes
 * out: published posts on the day they went live, scheduled ones on their
 * scheduled day and time. Quick Post's publish step writes to the same store,
 * so a post scheduled there appears here without a reload.
 *
 * Month grid or a dated list, filtered by status; an "Up next" rail lists the
 * scheduled posts still to go out. A day with posts opens a modal listing
 * them, with metrics for the published ones.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarCheck2, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, Heart, List, Eye, Plus, Send, TrendingUp,
} from 'lucide-react';
import Modal from '../../shared/Modal';
import { BrandMark } from '../3.1-content-studio/ContentBoard';
import { timeZoneName } from '../3.1-content-studio/schedule';
import { useOptionalPosts } from '../../../services/postStore';
import type { PublishedPost } from '../../../types';
import { byWhen, dayFromIso, isUpcoming, isoDay, monthWeeks, toEntry } from './calendarModel';
import type { CalEntry, CalStatus } from './calendarModel';
import { useAppPath } from '../../../layout/shellContext';
import './calendar.css';

type Filter = 'all' | CalStatus;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLATFORM_NAMES: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
const STATUS_LABEL: Record<CalStatus, string> = { scheduled: 'Scheduled', published: 'Published', draft: 'Draft', processing: 'Processing', inbox: 'Finish in TikTok', failed: 'Failed', cancelled: 'Cancelled' };
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];
const MAX_CHIPS = 3;

const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const longDay = (day: string) => dayFromIso(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = (day: string) => dayFromIso(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const compact = (n: number | null) => n == null ? 'Unavailable' : (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

function Thumb({ post }: { post: PublishedPost }) {
  return (
    <span className="cal-thumb" aria-hidden="true">
      {post.mediaUrl ? (post.mediaType === 'video' ? <video src={post.mediaUrl} muted playsInline preload="metadata" /> : <img src={post.mediaUrl} alt="" />) : <CalendarDays size={18} />}
    </span>
  );
}

/** One post, as the day modal and the list view show it. */
function PostLine({ entry }: { entry: CalEntry }) {
  const { post } = entry;
  const name = PLATFORM_NAMES[post.platform] ?? post.platform;
  return (
    <li className="cal-line">
      <Thumb post={post} />
      <div className="cal-line-body">
        <div className="cal-line-top">
          <BrandMark platform={post.platform} />
          <span className="cal-line-platform">{name}</span>
          <span className="lib-badge" data-status={post.status}>{STATUS_LABEL[post.status]}</span>
          {entry.time && (
            <span className="cal-line-time"><Clock3 size={13} aria-hidden="true" /> {entry.time}</span>
          )}
        </div>
        <p className="cal-line-caption">{post.caption}</p>
        {post.status === 'published' && post.metricsAvailable !== false && (
          <p className="cal-line-metrics">
            <span><Eye size={13} aria-hidden="true" /> {compact(post.reach)} reach</span>
            <span><Heart size={13} aria-hidden="true" /> {compact(post.likes)} likes</span>
            <span><TrendingUp size={13} aria-hidden="true" /> {post.engagementRate == null ? 'Unavailable' : `${post.engagementRate}%`} engagement</span>
          </p>
        )}
      </div>
    </li>
  );
}

function MonthGrid({ year, month, byDay, today, onOpenDay }: {
  year: number; month: number; byDay: Map<string, CalEntry[]>; today: string; onOpenDay: (day: string) => void;
}) {
  const weeks = monthWeeks(year, month);
  return (
    <div className="cal-grid" role="grid" aria-label={monthLabel(year, month)}>
      <div className="cal-week cal-week--head" role="row">
        {WEEKDAYS.map((d) => <span key={d} role="columnheader" className="cal-weekday">{d}</span>)}
      </div>
      {weeks.map((week) => (
        <div key={week[0].day} className="cal-week" role="row">
          {week.map((cell) => {
            const entries = cell.inMonth ? byDay.get(cell.day) ?? [] : [];
            const isToday = cell.day === today;
            const body = (
              <>
                <span className="cal-date">{cell.date}</span>
                {entries.slice(0, MAX_CHIPS).map((e) => (
                  <span key={e.post.id} className="cal-chip" data-status={e.post.status}>
                    <span className="cal-chip-top">
                      <BrandMark platform={e.post.platform} />
                      <span className="cal-chip-time">{e.time ?? STATUS_LABEL[e.post.status]}</span>
                    </span>
                    <span className="cal-chip-title">{e.title}</span>
                  </span>
                ))}
                {entries.length > MAX_CHIPS && <span className="cal-more">+{entries.length - MAX_CHIPS} more</span>}
              </>
            );
            return (
              <div
                key={cell.day}
                role="gridcell"
                className="cal-cell"
                data-out={!cell.inMonth || undefined}
                data-today={isToday || undefined}
                aria-current={isToday ? 'date' : undefined}
              >
                {entries.length ? (
                  <button
                    type="button"
                    className="cal-cell-btn"
                    onClick={() => onOpenDay(cell.day)}
                    aria-label={`${longDay(cell.day)}: ${entries.length} post${entries.length === 1 ? '' : 's'}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="cal-cell-btn">{body}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ListView({ entries, today }: { entries: CalEntry[]; today: string }) {
  if (!entries.length) {
    return (
      <div className="cal-empty">
        <CalendarDays size={22} aria-hidden="true" />
        <p>No posts this month.</p>
      </div>
    );
  }
  const days = [...new Set(entries.map((e) => e.day))];
  return (
    <div className="cal-list">
      {days.map((day) => (
        <section key={day} className="cal-list-day" aria-label={longDay(day)}>
          <h3 className="cal-list-date">
            {shortDay(day)}
            {day === today && <span className="cal-today-tag">Today</span>}
          </h3>
          <ul className="cal-lines">
            {entries.filter((e) => e.day === day).map((e) => <PostLine key={e.post.id} entry={e} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function CalendarView({ posts: injected, now: fixedNow }: { posts?: PublishedPost[]; now?: Date } = {}) {
  const store = useOptionalPosts();
  const posts = injected ?? store?.posts ?? null;
  const now = useMemo(() => fixedNow ?? new Date(), [fixedNow]);
  const today = isoDay(now);
  const { pathname } = useLocation();
  const appPath = useAppPath();
  const studioPath = pathname.startsWith('/preview') ? '/preview/content' : appPath('/content');

  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [view, setView] = useState<'month' | 'list'>('month');
  const [filter, setFilter] = useState<Filter>('all');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const closeDay = useCallback(() => setOpenDay(null), []);

  const entries = useMemo(() => (posts ?? []).map(toEntry).sort(byWhen), [posts]);
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.day.startsWith(monthPrefix));
  const shown = filter === 'all' ? monthEntries : monthEntries.filter((e) => e.post.status === filter);
  const countOf = (f: Filter) => (f === 'all' ? monthEntries.length : monthEntries.filter((e) => e.post.status === f).length);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEntry[]>();
    for (const e of shown) map.set(e.day, [...(map.get(e.day) ?? []), e]);
    return map;
  }, [shown]);

  const upcoming = entries.filter((e) => isUpcoming(e, now));
  const next = upcoming[0] ?? null;
  const publishedThisMonth = monthEntries.filter((e) => e.post.status === 'published').length;
  const dayEntries = openDay ? entries.filter((e) => e.day === openDay && (filter === 'all' || e.post.status === filter)) : [];

  const step = (delta: number) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const isThisMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  const jumpTo = (entry: CalEntry) => {
    const d = dayFromIso(entry.day);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setOpenDay(entry.day);
  };

  return (
    <div className="cal">
      <header className="cal-head">
        <div>
          <h1 className="cal-heading">Content Calendar</h1>
          <p className="cal-sub">Every post you&rsquo;ve scheduled or published, on the day it goes out.</p>
        </div>
        <Link to={studioPath} className="cal-new">
          <Plus size={16} aria-hidden="true" /> Create post
        </Link>
      </header>

      <div className="cal-stats" aria-busy={posts === null}>
        <div className="cal-stat">
          <span className="cal-stat-icon" data-tone="scheduled"><CalendarClock size={19} aria-hidden="true" /></span>
          <div>
            <p className="cal-stat-label">Scheduled</p>
            <p className="cal-stat-value"><span className="num">{upcoming.length}</span> upcoming</p>
          </div>
        </div>
        <div className="cal-stat">
          <span className="cal-stat-icon" data-tone="published"><CalendarCheck2 size={19} aria-hidden="true" /></span>
          <div>
            <p className="cal-stat-label">Published in {new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long' })}</p>
            <p className="cal-stat-value"><span className="num">{publishedThisMonth}</span> post{publishedThisMonth === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="cal-stat">
          <span className="cal-stat-icon" data-tone="next"><Send size={18} aria-hidden="true" /></span>
          <div>
            <p className="cal-stat-label">Next post</p>
            <p className="cal-stat-value">
              {next ? `${shortDay(next.day)}${next.time ? ` · ${next.time}` : ''}` : 'Nothing scheduled'}
            </p>
          </div>
        </div>
      </div>

      <div className="cal-layout">
        <section className="cal-card" aria-label="Calendar">
          <div className="cal-toolbar">
            <div className="cal-nav">
              <button type="button" className="cal-icon-btn" onClick={() => step(-1)} aria-label="Previous month">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" className="cal-icon-btn" onClick={() => step(1)} aria-label="Next month">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <h2 className="cal-month" aria-live="polite">{monthLabel(cursor.year, cursor.month)}</h2>
              <button
                type="button"
                className="cal-today-btn"
                onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
                disabled={isThisMonth}
              >
                Today
              </button>
            </div>
            <div className="cal-views" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>
                <CalendarDays size={15} aria-hidden="true" /> Month
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <List size={15} aria-hidden="true" /> List
              </button>
            </div>
          </div>

          <div className="cal-filters" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="cal-filter"
                data-status={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.id !== 'all' && <i aria-hidden="true" />}
                {f.label}
                <span className="num">{countOf(f.id)}</span>
              </button>
            ))}
          </div>

          {view === 'month' ? (
            <MonthGrid year={cursor.year} month={cursor.month} byDay={byDay} today={today} onOpenDay={setOpenDay} />
          ) : (
            <ListView entries={shown} today={today} />
          )}
        </section>

        <aside className="cal-rail" aria-labelledby="cal-upnext">
          <div className="cal-rail-head">
            <h2 id="cal-upnext" className="cal-rail-title">Up next</h2>
            <span className="cal-rail-count num">{upcoming.length}</span>
          </div>
          {posts === null ? (
            <p className="cal-rail-note">Loading your posts…</p>
          ) : upcoming.length ? (
            <ul className="cal-upnext">
              {upcoming.slice(0, 6).map((e) => {
                const d = dayFromIso(e.day);
                return (
                  <li key={e.post.id}>
                    <button
                      type="button"
                      className="cal-up"
                      onClick={() => jumpTo(e)}
                      aria-label={`${PLATFORM_NAMES[e.post.platform] ?? e.post.platform} post on ${longDay(e.day)}${e.time ? ` at ${e.time}` : ''}: ${e.title}`}
                    >
                      <span className="cal-up-date" aria-hidden="true">
                        <span>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                        <strong className="num">{d.getDate()}</strong>
                      </span>
                      <span className="cal-up-body">
                        <span className="cal-up-meta">
                          <BrandMark platform={e.post.platform} />
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}{e.time ? ` · ${e.time}` : ''}
                        </span>
                        <span className="cal-up-title">{e.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="cal-rail-empty">
              <CalendarClock size={22} aria-hidden="true" />
              <p>Nothing scheduled yet. Choose <strong>Schedule</strong> in Quick Post&rsquo;s publish step and it shows up here.</p>
              <Link to={studioPath} className="cal-rail-link">Open Quick Post</Link>
            </div>
          )}
          <p className="cal-rail-note">Times shown in {timeZoneName()}.</p>
        </aside>
      </div>

      <Modal open={openDay !== null} onClose={closeDay} title={openDay ? longDay(openDay) : undefined}>
        <p className="cal-modal-sub">{dayEntries.length} post{dayEntries.length === 1 ? '' : 's'}</p>
        <ul className="cal-lines">
          {dayEntries.map((e) => <PostLine key={e.post.id} entry={e} />)}
        </ul>
      </Modal>
    </div>
  );
}
