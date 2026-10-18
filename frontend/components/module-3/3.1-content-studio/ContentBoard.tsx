/**
 * Content Library — every draft, scheduled and published post.
 *
 * A toolbar to find things (search, platform, status, sort), status pills with
 * counts, and a table: the post (platform, thumbnail, date, caption), its
 * performance, its status, and actions — View, plus a menu with Copy caption.
 * Nothing here is computed; it renders the PublishedPost records.
 *
 * Any post opens in a detail view. Publishing from Quick Post lands here with
 * the new post already open, and the posts just published flagged in the list.
 *
 * No row checkboxes: there are no bulk actions yet, and a checkbox that does
 * nothing is worse than none.
 */
import {
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Facebook,
  ImageIcon,
  Inbox,
  Instagram,
  LayoutGrid,
  MoreVertical,
  Search,
  Send,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TikTokGlyph } from '../../shared/PlatformGlyphs';
import Modal from '../../shared/Modal';
import { useDismiss } from '../../shared/useDismiss';
import { formatSchedule } from './schedule';
import type { PublishedPost } from '@/types';
import { CaptionTranslationToggle } from './CaptionTranslationToggle';
import { useCaptionTranslation } from './useCaptionTranslation';
import type { BoardSlotProps } from './contentStudioTypes';

type Filter = 'all' | 'draft' | 'scheduled' | 'published';
const FILTERS: Filter[] = ['all', 'draft', 'scheduled', 'published'];

const STATUS_CHIP: Record<PublishedPost['status'], string> = {
  published: 'chip--success',
  scheduled: 'chip--scheduled',
  draft: 'chip--muted',
};

const PLATFORM_NAMES: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

export function PlatformIcon({ platform }: { platform: string }) {
  const Icon = platform === 'instagram' ? Instagram : platform === 'facebook' ? Facebook : null;
  return (
    <span className="lib-plat" data-platform={platform} aria-hidden="true">
      {Icon ? <Icon size={16} strokeWidth={1.75} /> : <TikTokGlyph size={15} />}
    </span>
  );
}

/** The platform's own colours, for the library's rows. */
export function BrandMark({ platform }: { platform: string }) {
  return (
    <span className="lib-brand" data-platform={platform} aria-hidden="true">
      {platform === 'instagram' ? <Instagram size={15} /> : platform === 'facebook' ? <Facebook size={15} /> : <TikTokGlyph size={13} />}
    </span>
  );
}

function RowMenu({ post, onOpen }: { post: PublishedPost; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close, btn);
  const name = PLATFORM_NAMES[post.platform] ?? post.platform;

  const copy = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — nothing to confirm, so nothing is shown.
    }
  };

  return (
    <div className="lib-menu-wrap" ref={ref}>
      <button
        ref={btn}
        type="button"
        className="lib-more"
        aria-label={copied ? 'Caption copied' : `More actions for ${name} post from ${post.date}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <MoreVertical size={15} aria-hidden="true" />}
      </button>
      {open && (
        <div className="lib-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpen(); }}>
            <Eye size={14} aria-hidden="true" /> View details
          </button>
          <button type="button" role="menuitem" onClick={copy}>
            <Copy size={14} aria-hidden="true" /> Copy caption
          </button>
        </div>
      )}
    </div>
  );
}

function Performance({ post }: { post: PublishedPost }) {
  if (post.status === 'published') {
    return (
      <div className="lib-perf">
        <span><b className="num">{post.reach.toLocaleString()}</b><em>reach</em></span>
        <span><b className="num">{post.likes.toLocaleString()}</b><em>likes</em></span>
      </div>
    );
  }
  if (post.status === 'scheduled' && post.scheduledFor) {
    return (
      <p className="lib-perf-note">
        <CalendarClock size={14} aria-hidden="true" /> Goes out {formatSchedule(post.scheduledFor)}
      </p>
    );
  }
  return <p className="lib-perf-note lib-perf-note--none">No results yet</p>;
}

const STATUS_LABEL: Record<PublishedPost['status'], string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
};

function PostRow({ post, isNew, onOpen }: { post: PublishedPost; isNew: boolean; onOpen: () => void }) {
  const name = PLATFORM_NAMES[post.platform] ?? post.platform;
  const translation = useCaptionTranslation(post.caption, { knownEnglish: post.captionEn, platform: post.platform });
  return (
    // The whole row opens the post — a pointer convenience; the View button is
    // the keyboard and screen-reader control.
    <li
      className="lib-row"
      data-new={isNew || undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="menu"]')) return;
        onOpen();
      }}
    >
      <div className="lib-cell lib-cell--content">
        <BrandMark platform={post.platform} />
        <span className="lib-thumb">
          {post.mediaUrl ? <img src={post.mediaUrl} alt="" loading="lazy" /> : <ImageIcon size={18} aria-hidden="true" />}
        </span>
        <div className="lib-text">
          <p className="lib-meta">
            <b>{name}</b>
            <span className="num">{post.date}</span>
          </p>
          <p className="lib-caption" lang={translation.showing === 'english' ? 'en' : undefined}>
            {translation.showing === 'english' ? translation.english : post.caption}
          </p>
          <CaptionTranslationToggle state={translation} />
        </div>
      </div>
      <div className="lib-cell lib-cell--perf"><Performance post={post} /></div>
      <div className="lib-cell lib-cell--status">
        {isNew && (
          <span className="lib-badge lib-badge--new">
            <Sparkles size={11} aria-hidden="true" /> {post.status === 'scheduled' ? 'Just scheduled' : 'Just published'}
          </span>
        )}
        <span className="lib-badge" data-status={post.status}>{STATUS_LABEL[post.status]}</span>
      </div>
      <div className="lib-cell lib-cell--actions">
        <button type="button" className="post-view" aria-label={`View ${name} post from ${post.date}`} onClick={onOpen}>
          <Eye size={15} aria-hidden="true" /> View
        </button>
        <RowMenu post={post} onOpen={onOpen} />
      </div>
    </li>
  );
}

/** A native select dressed as a toolbar control: icon, value, caret. */
function ToolSelect({ icon, label, value, onChange, children }: { icon: ReactNode; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="lib-select">
      <span className="lib-select-icon" aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      <ChevronDown size={15} className="lib-select-caret" aria-hidden="true" />
    </label>
  );
}

const METRICS: { key: keyof PublishedPost; label: string; suffix?: string }[] = [
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'engagementRate', label: 'Engagement rate', suffix: '%' },
];

function PostDetail({ post, siblings, isNew, onClose }: { post: PublishedPost | null; siblings: PublishedPost[]; isNew: boolean; onClose: () => void }) {
  const name = post ? PLATFORM_NAMES[post.platform] ?? post.platform : '';
  const published = post?.status === 'published';
  const scheduled = post?.status === 'scheduled';
  const others = siblings.map((s) => PLATFORM_NAMES[s.platform] ?? s.platform).join(' and ');
  const hasResults = Boolean(post && published && post.reach > 0);
  const translation = useCaptionTranslation(post?.caption ?? '', {
    knownEnglish: post?.captionEn,
    platform: post?.platform,
  });
  return (
    <Modal
      open={post != null}
      onClose={onClose}
      title={post ? (published ? `Published to ${name}` : scheduled ? `Scheduled for ${name}` : `${name} draft`) : 'Post'}
    >
      {post && (
        <div className="post-detail">
          {isNew && (
            <p className="post-detail-banner" role="status" data-tone={scheduled ? 'scheduled' : undefined}>
              {scheduled ? <CalendarClock size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
              <span>
                {scheduled && post.scheduledFor
                  ? <>Scheduled for {name} — {formatSchedule(post.scheduledFor)}.{others && <> Also scheduled for {others}.</>}</>
                  : <>Published to {name} just now.{others && <> Also published to {others}.</>}</>}
              </span>
            </p>
          )}

          <div className="post-detail-grid">
            <div className="post-detail-media">
              {post.mediaUrl ? (
                <img src={post.mediaUrl} alt={`The image published to ${name}`} />
              ) : (
                <span className="post-detail-media-empty">
                  <ImageIcon size={22} aria-hidden="true" /> No image on record
                </span>
              )}
            </div>

            <div className="post-detail-body">
              <div className="post-detail-meta">
                <PlatformIcon platform={post.platform} />
                <span className="post-plat">{name}</span>
                <span className={`chip ${STATUS_CHIP[post.status]}`}>{post.status}</span>
                <span className="post-date num">{scheduled && post.scheduledFor ? formatSchedule(post.scheduledFor) : post.date}</span>
              </div>

              <p className="post-detail-label">Caption</p>
              <CaptionTranslationToggle state={translation} />
              <p className="post-detail-caption" lang={translation.showing === 'english' ? 'en' : undefined}>
                {translation.showing === 'english' ? translation.english : post.caption}
              </p>

              <p className="post-detail-label">Results</p>
              {hasResults ? (
                <dl className="post-detail-metrics">
                  {METRICS.map(({ key, label, suffix }) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd className="num">
                        {(post[key] as number).toLocaleString()}
                        {suffix}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="post-detail-none">
                  {published
                    ? 'No results yet — reach and engagement appear here once the platform reports them.'
                    : scheduled
                      ? 'Results appear after the post goes out.'
                      : 'Drafts have no results until they are published.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

type PlatformFilter = 'all' | 'instagram' | 'tiktok' | 'facebook';
type Sort = 'latest' | 'oldest';

export default function ContentBoard({
  draft,
  posts,
  canPublish,
  onPublished,
  openPostId: openProp,
  onOpenPost,
  justPublished = [],
}: BoardSlotProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('latest');
  // Controlled when the parent passes it (Content Studio opens the new post on
  // arrival); local state otherwise.
  const [openLocal, setOpenLocal] = useState<string | null>(null);
  const openId = onOpenPost ? openProp ?? null : openLocal;
  const setOpen = onOpenPost ?? setOpenLocal;
  const openPost = posts.find((p) => p.id === openId) ?? null;
  const isNew = (id: string) => justPublished.includes(id);
  const siblings = openPost && isNew(openPost.id) ? posts.filter((p) => p.id !== openPost.id && isNew(p.id)) : [];

  // Counts follow the search and platform, so each pill says what it would show.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (platform === 'all' || p.platform === platform) &&
        (!q || p.caption.toLowerCase().includes(q) || (PLATFORM_NAMES[p.platform] ?? '').toLowerCase().includes(q)),
    );
  }, [posts, query, platform]);
  const count = (f: Filter) => (f === 'all' ? searched.length : searched.filter((p) => p.status === f).length);
  // Newly published first whatever the sort, then by date.
  const visible = useMemo(() => {
    const fresh = new Set(justPublished);
    const list = filter === 'all' ? searched : searched.filter((p) => p.status === filter);
    return [...list].sort((a, b) => {
      const byFresh = Number(fresh.has(b.id)) - Number(fresh.has(a.id));
      if (byFresh) return byFresh;
      return sort === 'latest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    });
  }, [searched, filter, sort, justPublished]);
  const filtered = query.trim() !== '' || platform !== 'all' || filter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setPlatform('all');
    setFilter('all');
  };

  return (
    <section className="lib" aria-labelledby="content-board-title">
      <div className="lib-head">
        <div>
          <h2 id="content-board-title" className="lib-title">Content Library</h2>
          <p className="lib-sub">All your drafts, published content, and campaign materials in one place.</p>
        </div>
        {/* Progressive disclosure: hidden, not disabled, until a passing audit. */}
        {canPublish && (
          <button type="button" className="btn-cta studio-head-act" title="Publish selected content" onClick={onPublished}>
            <Send size={16} aria-hidden="true" />
            Publish {draft.platforms.length ? `to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
          </button>
        )}
      </div>

      {canPublish && (
        <p className="studio-note">
          <CheckCircle2 size={18} aria-hidden="true" />
          Ready to publish after a successful compliance audit.
        </p>
      )}

      <div className="lib-toolbar">
        <label className="lib-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search posts</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, captions, or keywords…"
          />
        </label>
        <ToolSelect icon={<LayoutGrid size={15} />} label="Platform" value={platform} onChange={(v) => setPlatform(v as PlatformFilter)}>
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
        </ToolSelect>
        <ToolSelect icon={<Tag size={15} />} label="Status" value={filter} onChange={(v) => setFilter(v as Filter)}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </ToolSelect>
        <ToolSelect icon={<ArrowUpDown size={15} />} label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
          <option value="latest">Latest First</option>
          <option value="oldest">Oldest First</option>
        </ToolSelect>
      </div>

      <div className="lib-pills" role="tablist" aria-label="Filter content">
        {FILTERS.map((item) => (
          <button type="button" key={item} role="tab" aria-selected={filter === item} onClick={() => setFilter(item)}>
            <span className="capitalize">{item}</span> <span className="lib-pill-count num">{count(item)}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="lib-empty">
          <span className="lib-empty-glyph" aria-hidden="true">
            <Inbox size={20} strokeWidth={1.75} />
          </span>
          <p className="lib-empty-title">{posts.length === 0 ? 'Nothing in your library yet' : 'No posts match'}</p>
          <p className="lib-empty-sub">
            {posts.length === 0 ? 'Posts you publish from Quick Post appear here.' : 'Try another search, platform or status.'}
          </p>
          {posts.length > 0 && filtered && (
            <button type="button" className="btn-outline btn-outline--sm mt-3" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="lib-table">
          <div className="lib-thead" aria-hidden="true">
            <span>Content</span>
            <span>Performance</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <ul className="lib-rows" aria-label="Posts">
            {visible.map((post) => (
              <PostRow key={post.id} post={post} isNew={isNew(post.id)} onOpen={() => setOpen(post.id)} />
            ))}
          </ul>
        </div>
      )}

      {/* Mounted only while a post is open — nothing to put on the overlay stack otherwise. */}
      {openPost && (
        <PostDetail post={openPost} siblings={siblings} isNew={isNew(openPost.id)} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
