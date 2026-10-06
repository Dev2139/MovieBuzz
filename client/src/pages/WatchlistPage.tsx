import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserWatchlist, fetchContentList } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getLocalWatchlist } from '../utils/localStorage';
import { MediaCard } from '../components/MediaCard';
import { Bookmark, Sparkles } from 'lucide-react';
import { Content } from '../types';

export const WatchlistPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [localContent, setLocalContent] = useState<Content[]>([]);
  const [isLocalLoading, setIsLocalLoading] = useState<boolean>(!user);

  // Authenticated Watchlist
  const { data: authData, isLoading: isAuthLoading } = useQuery({
    queryKey: ['user-watchlist', user?.id],
    queryFn: fetchUserWatchlist,
    enabled: !!user,
  });

  // Anonymous local storage watchlist resolution
  useEffect(() => {
    if (!user) {
      const localIds = getLocalWatchlist();
      if (localIds.length > 0) {
        fetchContentList({ limit: 50 })
          .then((res) => {
            const filtered = res.items.filter((item) => localIds.includes(item._id));
            setLocalContent(filtered);
          })
          .catch(() => {})
          .finally(() => setIsLocalLoading(false));
      } else {
        setLocalContent([]);
        setIsLocalLoading(false);
      }
    }
  }, [user]);

  const items = user ? authData?.watchlist || [] : localContent;
  const isLoading = user ? isAuthLoading : isLocalLoading;

  return (
    <div className="min-h-screen bg-dark-base text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-brand-500/20 border border-brand-500/40 rounded-xl flex items-center justify-center text-brand-500">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Watchlist</h1>
            <p className="text-xs text-gray-400">
              {user ? 'Synchronized across your registered account' : 'Saved locally in your current browser'}
            </p>
          </div>
        </div>

        {!user && (
          <button
            onClick={openAuthModal}
            className="flex items-center space-x-2 bg-dark-card border border-brand-500/40 text-brand-500 hover:text-white hover:bg-brand-500 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sign In to Sync Across Devices</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-dark-card rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {items.map((item) => (
            <div key={item._id} className="flex justify-center">
              <MediaCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl space-y-2">
          <Bookmark className="w-12 h-12 text-brand-500 mx-auto opacity-40" />
          <p className="text-lg font-semibold text-white">Your Watchlist is Empty</p>
          <p className="text-xs">Click "+ Watchlist" on any movie or series poster to save it here for later.</p>
        </div>
      )}
    </div>
  );
};
