import React, { useState } from 'react';
import { RecommendationFeed, Content } from '../types';
import { HorizontalCarousel } from './HorizontalCarousel';
import { InterestsModal } from './InterestsModal';
import { Sparkles, SlidersHorizontal, Compass, Film, Flame, Heart, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecommendationSectionProps {
  data?: RecommendationFeed;
  isLoading: boolean;
  onRefresh?: () => void;
  availableGenres?: string[];
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  data,
  isLoading,
  onRefresh,
  availableGenres,
}) => {
  const navigate = useNavigate();
  const [isInterestsModalOpen, setIsInterestsModalOpen] = useState(false);

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 bg-dark-surface rounded w-48 animate-pulse" />
          <div className="h-6 bg-dark-surface rounded w-24 animate-pulse" />
        </div>
        <div className="flex space-x-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-36 sm:w-44 h-56 sm:h-64 bg-dark-surface/60 rounded-xl animate-pulse flex-none"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { topPicks, becauseYouWatched, genrePicks, inspiredByFavorites, userInterests, isColdStart } = data;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Personalized Intelligence Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-brand-900/40 via-dark-card to-dark-card border border-brand-500/20 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-none shadow-sm">
              <Sparkles className="w-5 h-5 text-brand-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  Personalized For You
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-[10px] font-bold text-brand-300 uppercase tracking-wider">
                  Smart Engine
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {userInterests && userInterests.length > 0
                  ? `Tuned to your affinity for ${userInterests.slice(0, 3).map((u) => u.genre).join(', ')}`
                  : 'Curated using viewing history, ratings & genre affinity'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            {/* Top User Interest Badges */}
            {userInterests && userInterests.length > 0 && (
              <div className="hidden md:flex items-center space-x-1.5 mr-2">
                {userInterests.slice(0, 3).map((u) => (
                  <span
                    key={u.genre}
                    className="px-2.5 py-1 bg-dark-surface border border-dark-border/80 text-gray-300 rounded-lg text-[11px] font-medium"
                  >
                    {u.genre}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsInterestsModalOpen(true)}
              className="px-3.5 py-1.5 bg-dark-surface hover:bg-brand-500/20 text-gray-200 hover:text-brand-300 border border-dark-border hover:border-brand-500/40 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-400" />
              <span>Tune Interests</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cold Start Discovery Prompt Banner */}
      {isColdStart && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-950 via-dark-card to-dark-surface border border-brand-500/30 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-brand-400">
                New Viewer Setup
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Tell us what you like for precision recommendations!
              </h3>
              <p className="text-xs text-gray-400 max-w-xl">
                Choose 2 or more of your favorite genres. Our recommendation engine will customize your feed with titles tailored to your taste.
              </p>
            </div>

            <button
              onClick={() => setIsInterestsModalOpen(true)}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center space-x-2 flex-none"
            >
              <Compass className="w-4 h-4" />
              <span>Choose Your Genres</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Main Top Picks Carousel */}
      {topPicks && topPicks.length > 0 && (
        <HorizontalCarousel
          title="Top Picks For You"
          subtitle="Curated from your viewing history, favorites, and genre preferences"
          items={topPicks}
          icon={<Sparkles className="w-5 h-5 text-brand-500" />}
        />
      )}

      {/* 2. "Because You Watched [Title]" Row */}
      {becauseYouWatched && becauseYouWatched.items.length > 0 && (
        <div className="space-y-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-3">
            {becauseYouWatched.basedOn.posterUrl && (
              <img
                src={becauseYouWatched.basedOn.posterUrl}
                alt={becauseYouWatched.basedOn.title}
                className="w-7 h-10 object-cover rounded-md shadow border border-dark-border/80 flex-none"
              />
            )}
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <Film className="w-4 h-4 text-brand-500" />
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">
                  Because You Watched{' '}
                  <span className="text-brand-400 font-extrabold">"{becauseYouWatched.basedOn.title}"</span>
                </h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Similar themes, genre dynamics, and cinematic style
              </p>
            </div>
          </div>

          <HorizontalCarousel
            title=""
            items={becauseYouWatched.items}
            icon={<Film className="w-5 h-5 text-brand-500" />}
          />
        </div>
      )}

      {/* 3. "Because You Love [Top Genre]" Row */}
      {genrePicks && genrePicks.items.length > 0 && (
        <HorizontalCarousel
          title={`More in ${genrePicks.genre}`}
          subtitle={`Top rated and trending titles matching your favorite genre`}
          items={genrePicks.items}
          icon={<Flame className="w-5 h-5 text-brand-500" />}
        />
      )}

      {/* 4. "Inspired by Your Favorites" Row */}
      {inspiredByFavorites && inspiredByFavorites.length > 0 && (
        <HorizontalCarousel
          title="Inspired by Your Favorites"
          subtitle="Recommendations matching titles saved in your favorites list"
          items={inspiredByFavorites}
          icon={<Heart className="w-5 h-5 text-brand-500" />}
        />
      )}

      {/* Interests Customization Modal */}
      <InterestsModal
        isOpen={isInterestsModalOpen}
        onClose={() => setIsInterestsModalOpen(false)}
        onSaved={() => {
          onRefresh?.();
        }}
        availableGenres={availableGenres}
        initialSelected={userInterests?.map((u) => u.genre)}
      />
    </div>
  );
};
