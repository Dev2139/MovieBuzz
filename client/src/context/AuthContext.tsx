import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, migrateLocalDataApi } from '../services/api';
import { getLocalPlaybackHistory, getLocalWatchlist, getLocalFavorites } from '../utils/localStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cinestream_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data && res.data.user) {
          setUser(res.data.user);
        }
      } catch {
        setUser(null);
        setToken(null);
        localStorage.removeItem('cinestream_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const triggerDataMigration = async () => {
    try {
      const localHistory = getLocalPlaybackHistory();
      const localWatchlist = getLocalWatchlist();
      const localFavorites = getLocalFavorites();

      if (localHistory.length > 0 || localWatchlist.length > 0 || localFavorites.length > 0) {
        console.log('[Auth] Migrating anonymous local storage history and watchlist to user account...');
        await migrateLocalDataApi({
          localHistory,
          localWatchlist,
          localFavorites,
        });
      }
    } catch (e) {
      console.warn('Failed to migrate local data during login', e);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await api.post('/auth/login', { email, password: pass });
    const { token: newToken, user: userData } = res.data;

    setToken(newToken);
    setUser(userData);
    localStorage.setItem('cinestream_token', newToken);

    // Automatically migrate local anonymous data to user account
    await triggerDataMigration();
    setIsAuthModalOpen(false);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await api.post('/auth/register', { name, email, password: pass });
    const { token: newToken, user: userData } = res.data;

    setToken(newToken);
    setUser(userData);
    localStorage.setItem('cinestream_token', newToken);

    await triggerDataMigration();
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('cinestream_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
