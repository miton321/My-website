import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import PublicPortfolio from './pages/PublicPortfolio.tsx';

const AdminPortal = lazy(() => import('./pages/AdminPortal.tsx'));

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-(--bg-canvas) px-6 text-center text-(--text-ink)">
          <h1 className="font-display text-2xl font-semibold">Unable to render page</h1>
          <p className="mt-2 max-w-md text-sm text-(--text-muted)">
            A runtime error occurred while initializing the view. Please reload the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 border border-(--border-hairline) px-4 py-2 text-xs font-medium hover:border-(--accent)"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [hash, setHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash : '',
  );

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const pathname =
    typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';
  const isAdminRoute =
    pathname === '/portal-x7k2' ||
    pathname.endsWith('/portal-x7k2') ||
    hash === '#/portal-x7k2';

  return (
    <AppErrorBoundary>
      {isAdminRoute ? (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) text-sm text-(--text-muted)">
              Loading...
            </div>
          }
        >
          <AdminPortal />
        </Suspense>
      ) : (
        <PublicPortfolio />
      )}
    </AppErrorBoundary>
  );
}
