import React from 'react';
import { RecommendationFeed } from '../types';
import { HorizontalCarousel } from './HorizontalCarousel';
import { Sparkles, Film, Flame, Heart } from 'lucide-react';

interface RecommendationSectionProps {
  data?: RecommendationFeed;
  isLoading: boolean;
  onRefresh?: () => void;
  availableGenres?: string[];
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  data,
  isLoading,
}) => {
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

  const { topPicks, becauseYouWatched, genrePicks, inspiredByFavorites } = data;

  return (
    <div className="space-y-6 sm:space-y-8">
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
    </div>
  );
};
