/**
 * Sidebar/Topbar navigation table — transcribed from
 * ui-ux-prototype.html:1792–1803. `content2` (superseded Content Studio v2
 * draft) is intentionally excluded per
 * docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md
 * decision 1.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  TrendingUp,
  Building2,
  Share2,
  Users,
} from 'lucide-react';

export type NavId =
  | 'dashboard'
  | 'content'
  | 'calendar'
  | 'performance'
  | 'settings-profile'
  | 'settings-platforms'
  | 'settings-workspace';

export interface NavSection {
  section: string;
}

export interface NavItem {
  id: NavId;
  /**
   * Explicit rather than derived from `id`. The Settings destinations are
   * nested (/settings/profile), so `/${id}` no longer describes every route.
   */
  path: string;
  label: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  badge?: number;
}

export type NavEntry = NavSection | NavItem;

function isNavItem(entry: NavEntry): entry is NavItem {
  return 'id' in entry;
}

export const NAV: NavEntry[] = [
  { section: 'Intelligence' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard', sub: 'Alert command center', badge: 2 },
  { section: 'Create' },
  { id: 'content', path: '/content', label: 'Content Studio', icon: Sparkles, title: 'Content Studio', sub: 'Draft, audit and publish' },
  { id: 'calendar', path: '/calendar', label: 'Calendar', icon: CalendarDays, title: 'Calendar', sub: 'Publishing schedule' },
  { section: 'Measure' },
  { id: 'performance', path: '/performance', label: 'Performance', icon: TrendingUp, title: 'Performance', sub: 'Campaign analytics & PES' },
  // The three Settings destinations are peers of every other nav item rather
  // than a nested list under a parent: the section label already says
  // "Settings", so a Settings row inside it was naming the group twice, and the
  // indented sub-list gave three of the app's destinations a second, quieter
  // visual class for no reason.
  { section: 'Settings' },
  { id: 'settings-profile', path: '/settings/profile', label: 'Business Profile', icon: Building2, title: 'Business Profile', sub: 'Identity, categories and uniqueness' },
  { id: 'settings-platforms', path: '/settings/platforms', label: 'Platforms', icon: Share2, title: 'Platforms', sub: 'Connected publishing accounts' },
  { id: 'settings-workspace', path: '/settings/workspace', label: 'Workspace', icon: Users, title: 'Workspace', sub: 'Team members and access' },
];

export function navItems(): NavItem[] {
  return NAV.filter(isNavItem);
}

export function navItemById(id: NavId): NavItem | undefined {
  return navItems().find((n) => n.id === id);
}
