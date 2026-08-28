/**
 * CARD — Foundation: Calendar Shell
 * Depends on: Foundation — Shell & Routing, Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-F2)
 *
 * Does NOT reuse or extend frontend/old-components/CalendarView.tsx (legacy, untouched
 * per .claude/CLAUDE.md).
 *
 * TODO (Month Grid & Navigation):
 * - 7-column grid, leading/trailing days greyed + inert, today ringed, up to 3
 *   platform-colored chips per day + "+N more"
 * - Month navigation (prev/next, wraps Dec<->Jan), per-status counts header
 * - A post published from Content Studio must appear on today's cell without a reload
 *
 * TODO (List View & Day-Click Modal):
 * - List view — flat reverse-chronological list with status chips
 * - Day click (only on days with >=1 post) opens a modal listing that day's posts;
 *   published posts show reach/likes/engagement inline
 *
 * CalendarView.test.tsx: month-boundary cell distribution (leading/trailing/today),
 * day-click no-op vs. modal-open branches.
 */
import { useState, useMemo } from 'react';
// This screen is self-contained until the shared design-token bridge lands.
// It replaces the missing local constants module without depending on legacy UI.
const COLORS = {
  GREEN_LIGHT: '#E6F4EE', GREEN: '#506E53', LIGHTNAVY: '#183C7B',
  TEXT_LIGHT: '#64748B', GOLD_LIGHT: '#FFF5DF', DARK_GOLD: '#D48E15',
  TEAL: '#007892', RED: '#A70000', LIGHT_GREY: '#C7D3E2',
  TEXT_MAIN: '#0A2342', TEXT_MUTED: '#64748B', CREAM: '#FDFBF7',
  WHITE: '#FFFFFF', NAVY: '#0F2854',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = 'published' | 'scheduled' | 'draft' | 'peak' | 'micro-season' | 'opportunity';

interface Post {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  status: PostStatus;
  platform?: string;
  reach?: number;
  likes?: number;
  engagementRate?: number;
  market?: string;
}

interface CalendarViewProps {
  /** Injected from shared store; defaults to mock data when absent */
  posts?: Post[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<PostStatus, { label: string; bg: string; text: string; dot: string }> = {
  published:     { label: 'Published',    bg: COLORS.GREEN_LIGHT,  text: COLORS.GREEN,       dot: COLORS.GREEN },
  scheduled:     { label: 'Scheduled',    bg: '#EEF3FF',           text: COLORS.LIGHTNAVY,   dot: COLORS.LIGHTNAVY },
  draft:         { label: 'Draft',        bg: '#F1F5F9',           text: COLORS.TEXT_LIGHT,  dot: COLORS.TEXT_LIGHT },
  peak:          { label: 'Peak Season',  bg: COLORS.GOLD_LIGHT,   text: COLORS.DARK_GOLD,   dot: COLORS.GOLD },
  'micro-season':{ label: 'Micro-Season', bg: '#EEF9FF',           text: COLORS.TEAL,        dot: COLORS.TEAL },
  opportunity:   { label: 'Opportunity',  bg: '#FFF0F0',           text: COLORS.RED,         dot: COLORS.RED },
};

const MOCK_POSTS: Post[] = [
  // Published — today (Aug 25 2026)
  { id: 'p1', title: 'Aerial Overwater Villas', date: '2026-08-25', status: 'published', platform: 'Instagram', reach: 31000, likes: 2800, engagementRate: 12.4 },
  { id: 'p2', title: 'POV Resort Walkthrough', date: '2026-08-25', status: 'published', platform: 'Facebook', reach: 22000, likes: 1500, engagementRate: 10.1 },
  { id: 'p3', title: 'Infinity Pool Reflection', date: '2026-08-25', status: 'published', platform: 'Instagram', reach: 14500, likes: 1100, engagementRate: 8.8 },
  { id: 'p4', title: 'Golden Hour Beachfront', date: '2026-08-25', status: 'scheduled', platform: 'TikTok' },
  // Rest of the month
  { id: 'p5', title: 'Sinulog Heritage Trail', date: '2026-08-18', status: 'published', platform: 'Instagram', reach: 18200, likes: 1540, engagementRate: 11.7 },
  { id: 'p6', title: 'Eco-Villa Plastic-Free', date: '2026-08-18', status: 'published', platform: 'Facebook', reach: 12500, likes: 890, engagementRate: 10.1 },
  { id: 'p7', title: 'Whale Shark Season Draft', date: '2026-08-20', status: 'draft', platform: 'Instagram' },
  { id: 'p8', title: 'Korean Summer Segment', date: '2026-08-12', status: 'published', platform: 'Facebook', reach: 9800, likes: 620, engagementRate: 9.2 },
  { id: 'p9', title: 'Golden Week Prep (JP)', date: '2026-08-28', status: 'scheduled', platform: 'Instagram', market: 'Japan' },
  { id: 'p10', title: 'Luxury Dive Resort Post', date: '2026-08-28', status: 'draft' },
  { id: 'p11', title: 'Oslob Peak Season Alert', date: '2026-08-05', status: 'peak', market: 'GLOBAL' },
  { id: 'p12', title: 'Coral Garden Micro-Season', date: '2026-08-14', status: 'micro-season', market: 'Korea' },
  { id: 'p13', title: 'Highland Trek Opportunity', date: '2026-08-30', status: 'opportunity', market: 'USA' },
  { id: 'p14', title: 'US Summer Campaign', date: '2026-08-30', status: 'scheduled', platform: 'Facebook' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_ORDER: PostStatus[] = ['published', 'scheduled', 'draft', 'peak', 'micro-season', 'opportunity'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function countByStatus(posts: Post[]): Partial<Record<PostStatus, number>> {
  return posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<PostStatus, number>>);
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ status, small = false }: { status: PostStatus; small?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: m.bg,
        color: m.text,
        borderRadius: 4,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        padding: small ? '1px 5px' : '2px 7px',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function PostRow({ post }: { post: Post }) {
  const isPublished = post.status === 'published';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: `1px solid ${COLORS.LIGHT_GREY}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.TEXT_MAIN, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {post.title}
        </div>
        {post.platform && (
          <div style={{ fontSize: 11, color: COLORS.TEXT_MUTED }}>{post.platform}</div>
        )}
      </div>
      <StatusChip status={post.status} small />
      {isPublished && post.reach !== undefined && (
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: COLORS.TEXT_MUTED, flexShrink: 0 }}>
          <span title="Reach">👁 {fmt(post.reach)}</span>
          <span title="Likes">♥ {fmt(post.likes ?? 0)}</span>
          <span title="Engagement" style={{ color: COLORS.GREEN, fontWeight: 600 }}>{post.engagementRate}%</span>
        </div>
      )}
    </div>
  );
}

function DayModal({ date, posts, onClose }: { date: string; posts: Post[]; onClose: () => void }) {
  const [d, m, y] = [
    parseInt(date.split('-')[2]),
    parseInt(date.split('-')[1]) - 1,
    parseInt(date.split('-')[0]),
  ];
  const label = `${MONTH_NAMES[m]} ${d}, ${y}`;
  const sorted = [...posts].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15,40,84,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.CREAM,
          borderRadius: 12,
          padding: '24px 28px',
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(15,40,84,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.TEXT_MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.NAVY }}>{label}</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: COLORS.TEXT_MUTED, padding: 4, borderRadius: 6,
              lineHeight: 1,
            }}
          >×</button>
        </div>
        <div>
          {sorted.map(p => <PostRow key={p.id} post={p} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  postsByDate,
  onDayClick,
}: {
  year: number;
  month: number;
  postsByDate: Map<string, Post[]>;
  onDayClick: (date: string, posts: Post[]) => void;
}) {
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  // Build flat grid of 42 cells (6 rows × 7)
  const cells: { date: string; day: number; type: 'prev' | 'curr' | 'next' }[] = [];

  for (let i = 0; i < firstDow; i++) {
    const day = daysInPrevMonth - firstDow + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ date: isoDate(prevYear, prevMonth, day), day, type: 'prev' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: isoDate(year, month, d), day: d, type: 'curr' });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ date: isoDate(nextYear, nextMonth, d), day: d, type: 'next' });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${COLORS.LIGHT_GREY}` }}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} style={{ padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: COLORS.TEXT_MUTED, letterSpacing: '0.06em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', flex: 1 }}>
        {cells.map(({ date, day, type }) => {
          const dayPosts = postsByDate.get(date) ?? [];
          const isToday = date === todayIso;
          const isCurr = type === 'curr';
          const hasEvents = dayPosts.length > 0;
          const visible = dayPosts.slice(0, 3);
          const overflow = dayPosts.length - 3;
          const sorted = [...visible].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

          return (
            <div
              key={date}
              onClick={() => isCurr && hasEvents && onDayClick(date, dayPosts)}
              style={{
                borderRight: `1px solid ${COLORS.LIGHT_GREY}`,
                borderBottom: `1px solid ${COLORS.LIGHT_GREY}`,
                padding: '6px 5px 4px',
                cursor: isCurr && hasEvents ? 'pointer' : 'default',
                background: isToday ? '#F0F5FF' : isCurr ? COLORS.CREAM : '#FAFAFA',
                opacity: isCurr ? 1 : 0.45,
                transition: 'background 0.12s',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={e => { if (isCurr && hasEvents) (e.currentTarget as HTMLDivElement).style.background = isToday ? '#E4EEFF' : '#F5F8FF'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isToday ? '#F0F5FF' : isCurr ? COLORS.CREAM : '#FAFAFA'; }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 1 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? COLORS.WHITE : isCurr ? COLORS.TEXT_MAIN : COLORS.TEXT_MUTED,
                    background: isToday ? COLORS.NAVY : 'transparent',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {day}
                </span>
              </div>

              {/* Chips */}
              {isCurr && sorted.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: STATUS_META[p.status].bg,
                    borderLeft: `2px solid ${STATUS_META[p.status].dot}`,
                    borderRadius: '0 3px 3px 0',
                    fontSize: 10,
                    fontWeight: 600,
                    color: STATUS_META[p.status].text,
                    padding: '1px 4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: '14px',
                  }}
                >
                  {p.title}
                </div>
              ))}

              {/* +N more */}
              {isCurr && overflow > 0 && (
                <div style={{ fontSize: 10, color: COLORS.TEXT_MUTED, fontWeight: 600, paddingLeft: 4 }}>
                  +{overflow} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ posts }: { posts: Post[] }) {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.TEXT_MUTED, fontSize: 14 }}>
        No posts this month.
      </div>
    );
  }

  // Group by date
  const byDate = sorted.reduce((acc, p) => {
    if (!acc[p.date]) acc[p.date] = [];
    acc[p.date].push(p);
    return acc;
  }, {} as Record<string, Post[]>);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 2px' }}>
      {Object.entries(byDate).map(([date, dayPosts]) => {
        const [y, m, d] = date.split('-').map(Number);
        const label = `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
        return (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: COLORS.TEXT_MUTED,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              marginBottom: 4, paddingBottom: 4,
              borderBottom: `1px solid ${COLORS.LIGHT_GREY}`,
            }}>
              {label}
            </div>
            {dayPosts.map(p => <PostRow key={p.id} post={p} />)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Original stub — DO NOT REMOVE (required by shell routing) ────────────────

function CalendarViewPlaceholder() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Calendar</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Calendar: Month Grid &amp; Navigation in
        04-module-3.md.
      </p>
    </div>
  );
}

// ─── Full implementation (swap default export above when ready) ───────────────

export function CalendarViewImpl({ posts: injectedPosts }: CalendarViewProps = {}) {
  const allPosts = injectedPosts ?? MOCK_POSTS;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<'month' | 'list'>('month');
  const [modal, setModal] = useState<{ date: string; posts: Post[] } | null>(null);

  // Posts in current month
  const monthPosts = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return allPosts.filter(p => p.date.startsWith(prefix));
  }, [allPosts, year, month]);

  // Index by date
  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of allPosts) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return map;
  }, [allPosts]);

  // Status counts header
  const counts = countByStatus(monthPosts);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const pillBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'default',
  };

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', background: COLORS.CREAM,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${COLORS.LIGHT_GREY}`,
          gap: 12, flexWrap: 'wrap',
        }}
      >
        {/* Left: nav + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            style={{
              background: 'none', border: `1px solid ${COLORS.LIGHT_GREY}`,
              borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.TEXT_MAIN, fontSize: 14, flexShrink: 0,
            }}
          >‹</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.NAVY, minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            style={{
              background: 'none', border: `1px solid ${COLORS.LIGHT_GREY}`,
              borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.TEXT_MAIN, fontSize: 14, flexShrink: 0,
            }}
          >›</button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            aria-label="Return to current month"
            style={{
              background: 'none', border: `1px solid ${COLORS.LIGHT_GREY}`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: COLORS.TEXT_MUTED,
            }}
          >Today</button>
        </div>

        {/* Center: status count pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.entries(counts) as [PostStatus, number][]).map(([status, count]) => {
            const m = STATUS_META[status];
            return (
              <span key={status} style={{ ...pillBase, background: m.bg, color: m.text }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot }} />
                {count} {m.label}
              </span>
            );
          })}
        </div>

        {/* Right: view toggle */}
        <div
          style={{
            display: 'flex', background: '#EEF1F7', borderRadius: 8, padding: 3, gap: 2,
          }}
        >
          {(['month', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              style={{
                background: view === v ? COLORS.WHITE : 'transparent',
                border: 'none', borderRadius: 6,
                padding: '5px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                color: view === v ? COLORS.NAVY : COLORS.TEXT_MUTED,
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {v === 'month' ? '⊞ Month' : '≡ List'}
            </button>
          ))}
        </div>
      </div>

      {/* ── View body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: view === 'list' ? '16px 20px' : 0 }}>
        {view === 'month' ? (
          <MonthGrid
            year={year}
            month={month}
            postsByDate={postsByDate}
            onDayClick={(date, posts) => setModal({ date, posts })}
          />
        ) : (
          <ListView posts={monthPosts} />
        )}
      </div>

      {/* ── Day-click Modal ── */}
      {modal && (
        <DayModal
          date={modal.date}
          posts={modal.posts}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function CalendarView() {
  return <CalendarViewImpl />;
}
