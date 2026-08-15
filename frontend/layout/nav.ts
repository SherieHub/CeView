/**
 * Sidebar/Topbar navigation table — transcribed from
 * ui-ux-prototype.html:1792–1803. `content2` (superseded Content Studio v2
 * draft) is intentionally excluded per
 * docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md
 * decision 1.
 */
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Sparkles, CalendarDays, TrendingUp, Settings } from 'lucide-react';

export type NavId = 'dashboard' | 'content' | 'calendar' | 'performance' | 'settings';

export interface NavSection {
  section: string;
}

export interface NavItem {
  id: NavId;
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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard', sub: 'Alert command center', badge: 2 },
  { section: 'Create' },
  { id: 'content', label: 'Content Studio', icon: Sparkles, title: 'Content Studio', sub: 'Draft, audit and publish' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, title: 'Calendar', sub: 'Publishing schedule' },
  { section: 'Measure' },
  { id: 'performance', label: 'Performance', icon: TrendingUp, title: 'Performance', sub: 'Campaign analytics & PES' },
  { section: 'Account' },
  { id: 'settings', label: 'Settings', icon: Settings, title: 'Settings', sub: 'Profile, platforms, workspace' },
];

export function navItems(): NavItem[] {
  return NAV.filter(isNavItem);
}

export function navItemById(id: NavId): NavItem | undefined {
  return navItems().find((n) => n.id === id);
}
