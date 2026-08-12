/**
 * Empty screen-shell placeholder for a route whose real screen hasn't
 * landed yet (later cards in 02-module-1.md … 05-module-4.md redistribute
 * these). Renders the NAV entry's title/sub so the shell is verifiably
 * wired end-to-end even before any screen exists.
 */
import { navItemById } from './nav';
import type { NavId } from './nav';

interface RoutePlaceholderProps {
  navId?: NavId;
  title?: string;
  sub?: string;
}

export default function RoutePlaceholder({ navId, title, sub }: RoutePlaceholderProps) {
  const nav = navId ? navItemById(navId) : undefined;
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">{title ?? nav?.title ?? 'Coming soon'}</h2>
      <p className="body-sm">{sub ?? nav?.sub ?? 'This screen has not been built yet.'}</p>
    </div>
  );
}
