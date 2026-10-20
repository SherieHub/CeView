/**
 * Content Studio's three views: Quick Post, Campaigns, Content Library.
 * A WAI-ARIA tab list — arrow keys, Home and End move between tabs; each tab
 * controls the panel with id `studio-panel-<view>`.
 */
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { FolderKanban, LibraryBig, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StudioView = 'quick' | 'campaigns' | 'library';

export const STUDIO_VIEWS: { id: StudioView; label: string; icon: LucideIcon }[] = [
  { id: 'quick', label: 'Quick Post', icon: PenLine },
  { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
  { id: 'library', label: 'Content Library', icon: LibraryBig },
];

interface StudioNavigationProps {
  view: StudioView;
  onChange: (view: StudioView) => void;
  /** Optional count beside a tab, e.g. library items. */
  counts?: Partial<Record<StudioView, number>>;
}

export default function StudioNavigation({ view, onChange, counts }: StudioNavigationProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    const i = STUDIO_VIEWS.findIndex((v) => v.id === view);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % STUDIO_VIEWS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + STUDIO_VIEWS.length) % STUDIO_VIEWS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = STUDIO_VIEWS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(STUDIO_VIEWS[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div className="studio-tabs" role="tablist" aria-label="Content Studio sections" ref={listRef} onKeyDown={onKeyDown}>
      {STUDIO_VIEWS.map(({ id, label, icon: Icon }) => {
        const selected = view === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`studio-tab-${id}`}
            aria-selected={selected}
            aria-controls={`studio-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {label}
            {counts?.[id] != null && <span className="studio-tab-count num">{counts[id]}</span>}
          </button>
        );
      })}
    </div>
  );
}
