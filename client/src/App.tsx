import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { ScrollToTop } from './components/ScrollToTop';

import { HomePage } from './pages/HomePage';
import { MoviesPage } from './pages/MoviesPage';
import { SeriesPage } from './pages/SeriesPage';
import { ContentDetailPage } from './pages/ContentDetailPage';
import { WatchPage } from './pages/WatchPage';
import { SearchPage } from './pages/SearchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminTelegramPage } from './pages/AdminTelegramPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 1000 * 5, // 5 seconds fresh cache
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

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <ScrollToTop />
            <div className="flex flex-col min-h-screen bg-dark-base relative">
              <Navbar />
              <main className="flex-1">
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
              </main>
              <Footer />
              <BottomNav />
              <AuthModal />
            </div>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
