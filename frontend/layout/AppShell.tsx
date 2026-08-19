/**
 * App shell — sidebar + topbar + routed <Outlet/>. Mounted for every
 * authenticated, post-onboarding route (see App.tsx's router tree).
 */
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useOverlayStack } from '../components/shared/useOverlayStack';

export default function AppShell() {
  const { scrimVisible, dismissTop } = useOverlayStack();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="content flex-1 overflow-y-auto bg-page p-6">
          <Outlet />
        </main>
      </div>
      {/* Shared backdrop for the drawer/modal overlay stack — see useOverlayStack.tsx.
          Base/hidden-state classes here must avoid any substring "on" (e.g. "transition",
          "none") — login.spec.ts asserts scrim state via toHaveClass(/on/), a plain
          substring regex against the whole class attribute, not a CSS class selector. */}
      <div
        id="scrim"
        className={`scrim fixed inset-0 z-20 bg-black/40 ${scrimVisible ? 'on' : 'invisible'}`}
        onClick={dismissTop}
      />
    </div>
  );
}
