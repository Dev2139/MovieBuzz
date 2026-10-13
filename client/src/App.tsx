import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PWAProvider } from './context/PWAContext';
import { ServerErrorProvider } from './context/ServerErrorContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { ScrollToTop } from './components/ScrollToTop';
import { InstallModal } from './components/InstallModal';
import { InstallBanner } from './components/InstallBanner';

// Route-based code splitting: each page is only downloaded when actually navigated to.
// This keeps the initial mobile bundle small and allows faster first paint.
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const MoviesPage = lazy(() => import('./pages/MoviesPage').then(m => ({ default: m.MoviesPage })));
const SeriesPage = lazy(() => import('./pages/SeriesPage').then(m => ({ default: m.SeriesPage })));
const ContentDetailPage = lazy(() => import('./pages/ContentDetailPage').then(m => ({ default: m.ContentDetailPage })));
const WatchPage = lazy(() => import('./pages/WatchPage').then(m => ({ default: m.WatchPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminTelegramPage = lazy(() => import('./pages/AdminTelegramPage').then(m => ({ default: m.AdminTelegramPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const PremiumPage = lazy(() => import('./pages/PremiumPage').then(m => ({ default: m.PremiumPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // 5-minute stale time: catalogue data rarely changes minute-to-minute.
      // Avoids redundant API round-trips on mobile (saves battery + bandwidth).
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="min-h-screen bg-dark-base flex items-center justify-center text-gray-400">Verifying privileges...</div>;
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isWatch = location.pathname.startsWith('/watch');

  return (
    <div className="flex flex-col min-h-screen bg-dark-base relative">
      {!isWatch && <Navbar />}
      <main className="flex-1">
        {/* Suspense boundary: shows nothing while the lazy chunk loads (pages render own skeletons) */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/movie/:slug" element={<ContentDetailPage />} />
            <Route path="/series/:slug" element={<ContentDetailPage />} />
            <Route path="/watch/movie/:slug" element={<WatchPage />} />
            <Route path="/watch/series/:seriesSlug/:season/:episode" element={<WatchPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/premium" element={<PremiumPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/telegram"
              element={
                <AdminRoute>
                  <AdminTelegramPage />
                </AdminRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {!isWatch && <Footer />}
      {!isWatch && <BottomNav />}
      {!isWatch && <InstallBanner />}
      <InstallModal />
      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ServerErrorProvider>
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <PWAProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <ScrollToTop />
                  <MainLayout />
                </BrowserRouter>
              </PWAProvider>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ServerErrorProvider>
    </QueryClientProvider>
  );
};

export default App;
