import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContentList, fetchContinueWatching, fetchGenres } from '../services/api';
import { HeroBanner } from '../components/HeroBanner';
import { HorizontalCarousel } from '../components/HorizontalCarousel';
import { SkeletonCard, SkeletonGrid } from '../components/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import { getLocalPlaybackHistory } from '../utils/localStorage';
import { LocalPlaybackState } from '../types';
import { Play, TrendingUp, Flame, Tv, Sparkles, Clock, Compass } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [localContinue, setLocalContinue] = useState<LocalPlaybackState[]>([]);

  useEffect(() => {
    if (!user) {
      setLocalContinue(getLocalPlaybackHistory());
    }
  }, [user]);

  // Authenticated Continue Watching query
  const { data: authContinueData } = useQuery({
    queryKey: ['continue-watching', user?.id],
    queryFn: fetchContinueWatching,
    enabled: !!user,
  });

  // Featured Content query for Hero
  const { data: featuredData, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ['featured-content'],
    queryFn: () => fetchContentList({ featured: 'true', limit: 5 }),
    refetchInterval: 15000,
  });

  // Trending Movies
  const { data: trendingMoviesData, isLoading: isTrendingMoviesLoading } = useQuery({
    queryKey: ['trending-movies'],
    queryFn: () => fetchContentList({ type: 'movie', sort: 'popular', limit: 10 }),
    refetchInterval: 15000,
  });

  // Popular Movies
  const { data: popularMoviesData } = useQuery({
    queryKey: ['popular-movies'],
    queryFn: () => fetchContentList({ type: 'movie', sort: 'rating', limit: 10 }),
    refetchInterval: 15000,
  });

  // Trending Series
  const { data: trendingSeriesData } = useQuery({
    queryKey: ['trending-series'],
    queryFn: () => fetchContentList({ type: 'series', sort: 'popular', limit: 10 }),
    refetchInterval: 15000,
  });

  // All Latest Content (Fallback query)
  const { data: allContentData, isLoading: isAllLoading } = useQuery({
    queryKey: ['all-latest-content'],
    queryFn: () => fetchContentList({ limit: 20 }),
    refetchInterval: 15000,
  });

  // Genres List
  const { data: genresData } = useQuery({
    queryKey: ['genres-list'],
    queryFn: fetchGenres,
  });

  // Pick best available item for Hero Banner
  const heroItem =
    (featuredData?.items && featuredData.items.length > 0 ? featuredData.items[0] : null) ||
    (trendingMoviesData?.items && trendingMoviesData.items.length > 0 ? trendingMoviesData.items[0] : null) ||
    (trendingSeriesData?.items && trendingSeriesData.items.length > 0 ? trendingSeriesData.items[0] : null) ||
    (popularMoviesData?.items && popularMoviesData.items.length > 0 ? popularMoviesData.items[0] : null) ||
    (allContentData?.items && allContentData.items.length > 0 ? allContentData.items[0] : null);

  const isLoading = isFeaturedLoading && isAllLoading;

  return (
    <div className="min-h-screen bg-dark-base text-white pb-24 md:pb-16 space-y-6 sm:space-y-8">
      {/* Hero Banner Section */}
      {heroItem ? (
        <HeroBanner item={heroItem} />
      ) : isLoading ? (
        <div className="h-[52vh] sm:h-[65vh] w-full bg-dark-surface/80 animate-pulse flex flex-col items-center justify-center space-y-3">
          <Sparkles className="w-10 h-10 text-brand-500/50 animate-spin" />
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Loading Cinematic Catalog...</p>
        </div>
      ) : (
        <div className="h-[380px] w-full bg-gradient-to-br from-dark-card to-dark-surface border-b border-dark-border flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-14 h-14 bg-brand-500/20 text-brand-500 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Welcome to CineStream</h2>
          <p className="text-gray-400 max-w-md text-xs sm:text-sm">
            Discover and stream licensed movies, TV series, and posts in ultra-high quality.
          </p>
        </div>
      )}

      {/* Continue Watching Section (Authenticated OR Anonymous) */}
      {user ? (
        authContinueData?.continueWatching && authContinueData.continueWatching.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-brand-500" />
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Continue Watching</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {authContinueData.continueWatching.map((item) => {
                if (!item.contentId) return null;
                const progressPct = item.duration > 0 ? Math.round((item.progress / item.duration) * 100) : 0;
                const targetPath =
                  item.contentId.type === 'movie'
                    ? `/watch/movie/${item.contentId.slug}`
                    : `/watch/series/${item.contentId.slug}/1/1`;

                return (
                  <div
                    key={item._id}
                    onClick={() => navigate(targetPath)}
                    className="group relative bg-dark-card border border-dark-border/80 hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-dark-surface relative">
                      <img
                        src={item.contentId.backdropUrl}
                        alt={item.contentId.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                        <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700">
                        <div className="h-full bg-brand-500" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">{item.contentId.title}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {item.episodeId ? `Episode ${item.episodeId.episodeNumber}` : `${progressPct}% watched`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )
      ) : (
        localContinue.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-brand-500" />
                <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Continue Watching</h2>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 bg-dark-surface border border-dark-border px-2.5 py-0.5 rounded-full">
                Saved in Browser
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {localContinue.map((item) => {
                const targetPath =
                  item.contentType === 'movie'
                    ? `/watch/movie/${item.contentSlug}`
                    : `/watch/series/${item.seriesSlug || item.contentSlug}/${item.seasonNumber || 1}/${item.episodeNumber || 1}`;

                return (
                  <div
                    key={`${item.contentId}_${item.episodeId}`}
                    onClick={() => navigate(targetPath)}
                    className="group relative bg-dark-card border border-dark-border/80 hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-dark-surface relative">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                        <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700">
                        <div className="h-full bg-brand-500" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">{item.title}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.percentage}% completed</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )
      )}

      {/* Main Carousels */}
      {isAllLoading ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="h-6 bg-dark-surface rounded w-48 animate-pulse mb-3" />
          <div className="flex space-x-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>
      ) : (
        allContentData?.items && allContentData.items.length > 0 && (
          <HorizontalCarousel
            title="Latest Movies & Posts"
            subtitle="Recently added cinema, TV episodes, and Telegram streams"
            items={allContentData.items}
            icon={<Sparkles className="w-5 h-5 text-brand-500" />}
          />
        )
      )}

      {trendingMoviesData?.items && trendingMoviesData.items.length > 0 && (
        <HorizontalCarousel
          title="Trending Movies"
          subtitle="Top streamed licensed movies this week"
          items={trendingMoviesData.items}
          icon={<Flame className="w-5 h-5 text-brand-500" />}
        />
      )}

      {popularMoviesData?.items && (
        <HorizontalCarousel
          title="Top Rated Cinema"
          subtitle="Highest critically acclaimed motion pictures"
          items={popularMoviesData.items}
          icon={<TrendingUp className="w-5 h-5 text-brand-500" />}
        />
      )}

      {trendingSeriesData?.items && (
        <HorizontalCarousel
          title="Trending TV Series"
          subtitle="Binge-worthy seasonal episodes and series"
          items={trendingSeriesData.items}
          icon={<Tv className="w-5 h-5 text-brand-500" />}
        />
      )}

      {/* Genre Explorer */}
      {genresData?.genres && genresData.genres.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center space-x-2 mb-3">
            <Compass className="w-5 h-5 text-brand-500" />
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Explore by Genre</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {genresData.genres.map((genre) => (
              <Link
                key={genre}
                to={`/movies?genre=${encodeURIComponent(genre)}`}
                className="bg-dark-card hover:bg-brand-500 border border-dark-border/80 hover:border-brand-500 text-gray-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all shadow active:scale-95"
              >
                {genre}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
