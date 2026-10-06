import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserHistory } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getLocalPlaybackHistory, clearLocalPlaybackHistory } from '../utils/localStorage';
import { LocalPlaybackState } from '../types';
import { History, Play, Trash2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [localHistory, setLocalHistory] = useState<LocalPlaybackState[]>([]);

  useEffect(() => {
    if (!user) {
      setLocalHistory(getLocalPlaybackHistory());
    }
  }, [user]);

  const { data: authData, isLoading } = useQuery({
    queryKey: ['user-history', user?.id],
    queryFn: fetchUserHistory,
    enabled: !!user,
  });

  const handleClearLocal = () => {
    clearLocalPlaybackHistory();
    setLocalHistory([]);
  };

  return (
    <div className="min-h-screen bg-dark-base text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-brand-500/20 border border-brand-500/40 rounded-xl flex items-center justify-center text-brand-500">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Playback History</h1>
            <p className="text-xs text-gray-400">
              {user ? 'Cloud synchronized watch history' : 'Stored in your current browser localStorage'}
            </p>
          </div>
        </div>

        {!user ? (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClearLocal}
              className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Local History</span>
            </button>
            <button
              onClick={openAuthModal}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create Account to Sync</span>
            </button>
          </div>
        ) : null}
      </div>

      {user ? (
        isLoading ? (
          <div className="py-20 text-center text-gray-400">Loading history...</div>
        ) : authData?.history && authData.history.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {authData.history.map((item) => {
              if (!item.contentId) return null;
              const pct = item.duration > 0 ? Math.round((item.progress / item.duration) * 100) : 0;
              const targetPath =
                item.contentId.type === 'movie'
                  ? `/watch/movie/${item.contentId.slug}`
                  : `/watch/series/${item.contentId.slug}/1/1`;

              return (
                <div
                  key={item._id}
                  onClick={() => navigate(targetPath)}
                  className="group bg-dark-card border border-dark-border hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.02]"
                >
                  <div className="aspect-video w-full overflow-hidden bg-dark-surface relative">
                    <img
                      src={item.contentId.backdropUrl}
                      alt={item.contentId.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center">
                      <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700">
                      <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-white text-sm line-clamp-1">{item.contentId.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.episodeId ? `Episode ${item.episodeId.episodeNumber}` : `${pct}% completed`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl">
            No watch history recorded on your account yet.
          </div>
        )
      ) : localHistory.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {localHistory.map((item) => {
            const targetPath =
              item.contentType === 'movie'
                ? `/watch/movie/${item.contentSlug}`
                : `/watch/series/${item.seriesSlug || item.contentSlug}/${item.seasonNumber || 1}/${item.episodeNumber || 1}`;

            return (
              <div
                key={`${item.contentId}_${item.episodeId}`}
                onClick={() => navigate(targetPath)}
                className="group bg-dark-card border border-dark-border hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.02]"
              >
                <div className="aspect-video w-full overflow-hidden bg-dark-surface relative">
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center">
                    <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700">
                    <div className="h-full bg-brand-500" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-white text-sm line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-gray-400 mt-1">{item.percentage}% completed</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl">
          No playback history recorded in browser yet.
        </div>
      )}
    </div>
  );
};
