import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Sparkles, CalendarDays, TrendingUp, Settings,
} from 'lucide-react';

/**
 * Ported from ui-ux-prototype.html:1792-1803 (the NAV table), minus the
 * `content2` entry — Content Studio v2 is a dropped draft per the plan's
 * "Decisions this plan assumes" §1, never built.
 *
 * Settings' three sub-tab ids (`profile`/`platforms`/`workspace`) are a
 * placeholder naming choice for this Foundation card — the actual Settings
 * sub-screens are built in later cards.
 */
export interface NavSubTab {
  id: string;
  label: string;
}

export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  /** Static placeholder unread count — real notification wiring is a later card. */
  badge?: number;
  subTabs?: NavSubTab[];
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const SETTINGS_SUB_TABS: NavSubTab[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'workspace', label: 'Workspace' },
];

export const NAV: NavSection[] = [
  {
    section: 'Intelligence',
    items: [
      {
        id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard,
        title: 'Dashboard', sub: 'Alert command center', badge: 2,
      },
    ],
  },
  {
    section: 'Create',
    items: [
      {
        id: 'content', path: '/content', label: 'Content Studio', icon: Sparkles,
        title: 'Content Studio', sub: 'Draft, audit and publish',
      },
      {
        id: 'calendar', path: '/calendar', label: 'Calendar', icon: CalendarDays,
        title: 'Calendar', sub: 'Publishing schedule',
      },
    ],
  },
  {
    section: 'Measure',
    items: [
      {
        id: 'performance', path: '/performance', label: 'Performance', icon: TrendingUp,
        title: 'Performance', sub: 'Campaign analytics & PES',
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        id: 'settings', path: '/settings/profile', label: 'Settings', icon: Settings,
        title: 'Settings', sub: 'Profile, platforms, workspace', subTabs: SETTINGS_SUB_TABS,
      },
    ],
  },
];

/** Flat list of every top-level nav item, sections stripped out. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap(s => s.items);

/**
 * Resolve a pathname to the NAV item + (if applicable) settings sub-tab it
 * belongs to, for the Topbar's per-route title/subtitle. Falls back to the
 * Dashboard entry when nothing matches (should not happen for routed paths).
 */
export function resolveNavForPath(pathname: string): { item: NavItem; subTab?: NavSubTab } {
  if (pathname.startsWith('/settings')) {
    const settingsItem = NAV_ITEMS.find(i => i.id === 'settings')!;
    const tabId = pathname.split('/')[2];
    const subTab = settingsItem.subTabs?.find(t => t.id === tabId);
    return { item: settingsItem, subTab };
  }
  const item = NAV_ITEMS.find(i => pathname.startsWith(i.path));
  return { item: item ?? NAV_ITEMS[0] };
}
