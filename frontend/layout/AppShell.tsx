/**
 * App shell — sidebar + topbar + routed <Outlet/>. Mounted for every
 * authenticated, post-onboarding route (see App.tsx's router tree).
 */
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useOverlayStack } from '../components/shared/useOverlayStack';

const COLLAPSE_KEY = 'ceview.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AppShell() {
  const { scrimVisible, dismissTop, stack } = useOverlayStack();
  // A drawer on its own is a side panel, not a modal: at desktop widths the
  // screen makes room for it (see .dash-screen) rather than sliding underneath,
  // so nothing is obscured and dimming would be claiming otherwise — while the
  // scrim's own hit area silently swallowed every click on the content beside
  // it. A modal, or a drawer on a narrow screen where it does cover the page,
  // still gets one. CSS decides on width; this only reports what is open.
  const onlyDrawer = stack.length === 1 && stack[0] === 'drawer';
  // Below 768px the rail is a slide-over rather than a grid column — otherwise
  // it stacks full-width above the content and every screen starts with a
  // screenful of navigation. Topbar's burger has always rendered; this is what
  // finally gives it something to do.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop collapse is a separate axis from the mobile slide-over above: the
  // rail stays in the layout and drops to icons only. Remembered per browser,
  // since it is a standing preference rather than a per-visit choice.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Private mode / blocked site data — the preference just will not persist.
    }
  }, [collapsed]);

  // Navigating is the signal that the operator is done with the menu.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    // Grid rather than flex so the sidebar keeps a real track and the shared
    // sticky-rail rule applies (see `.ob-rail, .sb-rail` in styles/index.css).
    // The content track is minmax(0, 1fr): the old `flex-1` carried an implicit
    // min-width:auto, so any wide child pushed the page into a horizontal
    // scroll — papered over until now by `.content * { min-width: 0 }`.
    <div className="app-wrap" data-sidebar-open={sidebarOpen} data-collapsed={collapsed}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      {/* Dismisses the mobile rail. Inert (and invisible) at desktop widths,
          where the rail is a normal grid column. Separate from the overlay
          scrim below, which belongs to the drawer/modal stack. */}
      <button
        type="button"
        className="sb-veil"
        aria-label="Close menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="app-col">
        <Topbar onToggleSidebar={() => setSidebarOpen((o) => !o)} sidebarOpen={sidebarOpen} />
        <main className="content app-main">
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
        data-panel={onlyDrawer}
        onClick={dismissTop}
      />
    </div>
  );
}
