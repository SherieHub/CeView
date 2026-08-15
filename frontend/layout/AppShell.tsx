/**
 * App shell — sidebar + topbar + routed <Outlet/>. Mounted for every
 * authenticated, post-onboarding route (see App.tsx's router tree).
 */
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="content flex-1 overflow-y-auto bg-page p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
