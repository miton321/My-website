import { lazy, Suspense } from 'react';
import PublicPortfolio from './pages/PublicPortfolio.tsx';

const AdminPortal = lazy(() => import('./pages/AdminPortal.tsx'));

export default function App() {
  const pathname =
    typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';

  if (pathname === '/portal-x7k2') {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) text-sm text-(--text-muted)">
            Loading...
          </div>
        }
      >
        <AdminPortal />
      </Suspense>
    );
  }

  return <PublicPortfolio />;
}
