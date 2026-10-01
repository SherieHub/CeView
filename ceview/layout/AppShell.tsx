import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { OverlayStackProvider, useOverlayStackContext } from '../components/shared/useOverlayStack';
import { ToastProvider } from '../components/shared/Toast';

/** Ported from primitives.css `#scrim` — visible whenever the overlay stack is non-empty. */
const Scrim: React.FC = () => {
  const { isScrimVisible, dismissTop } = useOverlayStackContext();
  return <div id="scrim" className={isScrimVisible ? 'on' : ''} onClick={dismissTop} />;
};

const ShellBody: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="app-shell" style={{ display: 'flex' }}>
      <Sidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />
      <div className="main">
        <Topbar onOpenMobileSidebar={() => setIsMobileOpen(true)} />
        <div className="content">
          <div className="wrap">
            <Outlet />
          </div>
        </div>
      </div>
      <Scrim />
    </div>
  );
};

/** Sidebar + topbar + <Outlet/>, wrapping the routed screens in the overlay stack + toast infrastructure. */
const AppShell: React.FC = () => (
  <OverlayStackProvider>
    <ToastProvider>
      <ShellBody />
    </ToastProvider>
  </OverlayStackProvider>
);

export default AppShell;
