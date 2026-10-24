/**
 * Where the app shell is mounted. The signed-in app lives at the root
 * (/dashboard, /content…); the public interactive demo mounts the same shell
 * and screens under /demo. Links between screens go through appPath() so they
 * stay inside whichever one the visitor is in.
 */
import { createContext, useCallback, useContext } from 'react';
import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';

export interface ShellMode {
  /** True inside the public interactive demo. */
  demo: boolean;
}

const ShellContext = createContext<ShellMode>({ demo: false });

export const ShellModeProvider = ShellContext.Provider;

export function useShellMode(): ShellMode {
  return useContext(ShellContext);
}

/** Destinations the demo covers; the rest need a real account. */
const DEMO_PATHS = new Set(['/dashboard', '/content', '/calendar', '/performance', '/settings/profile']);

export function isInDemo(path: string): boolean {
  return DEMO_PATHS.has(path);
}

/** Maps an app route (e.g. "/content") to the one for the current shell. */
export function toShellPath(path: string, demo: boolean): string {
  if (!demo) return path;
  return path === '/dashboard' ? '/demo' : `/demo${path}`;
}

export function useAppPath(): (path: string) => string {
  const { demo } = useShellMode();
  return useCallback((path: string) => toShellPath(path, demo), [demo]);
}

/** A Link to an app route that stays inside the demo when the visitor is in it. */
export function AppLink({ to, ...rest }: Omit<ComponentProps<typeof Link>, 'to'> & { to: string }) {
  const appPath = useAppPath();
  return <Link to={appPath(to)} {...rest} />;
}
