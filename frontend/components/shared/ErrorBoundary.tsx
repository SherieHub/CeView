/**
 * Contains an unexpected render-time crash to the routed content it wraps,
 * instead of letting it unmount the whole app to a blank page.
 *
 * React only catches render/lifecycle errors via a class component's
 * getDerivedStateFromError/componentDidCatch — there is no hook equivalent.
 * AppShell mounts this once, around <Outlet/>, passed `key={pathname}` there
 * (not a plain prop — React only clears a class component's state by
 * remounting it, which changing its `key` triggers) so a crash on one screen
 * doesn't survive navigating away from it.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error-reporting service wired up yet (see docs) — the console is the
    // only sink today, same as an uncaught error would have produced anyway.
    console.error('ErrorBoundary caught a render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="m-4 rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6"
        >
          <div className="flex items-center gap-2 text-[var(--color-critical-text)]">
            <AlertTriangle size={18} aria-hidden="true" />
            <h3 className="font-semibold">This screen hit an unexpected error</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-body)]">
            Something on this page failed to render. The rest of the app is unaffected — use the
            sidebar to go elsewhere, or reload to try this screen again.
          </p>
          <p className="mt-4 whitespace-pre-wrap break-words font-mono text-xs text-[var(--color-text-muted)]">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
