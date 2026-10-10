import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchContentList, fetchContinueWatching, fetchGenres, deleteHistoryItemApi } from '../services/api';
import { HeroBanner } from '../components/HeroBanner';
import { HorizontalCarousel } from '../components/HorizontalCarousel';
import { ContinueWatchingCarousel, ContinueWatchingItem } from '../components/ContinueWatchingCarousel';
import { SkeletonCard, SkeletonGrid } from '../components/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import { getLocalPlaybackHistory, removeLocalPlaybackItem } from '../utils/localStorage';
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

  const queryClient = useQueryClient();

  const handleRemoveContinueItem = async (item: ContinueWatchingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      await deleteHistoryItemApi(item.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    } else {
      const updated = removeLocalPlaybackItem(item.contentId, item.episodeId);
      setLocalContinue(updated);
    }
  };

  // Authenticated Continue Watching query
  const { data: authContinueData } = useQuery({
    queryKey: ['continue-watching', user?.id],
    queryFn: fetchContinueWatching,
    enabled: !!user,
  });

  const authContinueItems: ContinueWatchingItem[] = (authContinueData?.continueWatching || [])
    .filter((item) => item.contentId)
    .map((item) => {
      const content = item.contentId;
      const progressPct = item.duration > 0 ? Math.round((item.progress / item.duration) * 100) : 0;
      const targetPath =
        content.type === 'movie'
          ? `/watch/movie/${content.slug}`
          : `/watch/series/${content.slug}/${item.episodeId?.seasonNumber || 1}/${item.episodeId?.episodeNumber || 1}`;

      return {
        id: item._id,
        contentId: content._id,
        episodeId: item.episodeId?._id,
        title: content.title,
        posterUrl: content.posterUrl || content.backdropUrl,
        backdropUrl: content.backdropUrl,
        type: content.type,
        slug: content.slug,
        seasonNumber: item.episodeId?.seasonNumber,
        episodeNumber: item.episodeId?.episodeNumber,
        progressPct,
        rating: content.rating,
        releaseYear: content.releaseYear,
        targetPath,
      };
    });

  const localContinueItems: ContinueWatchingItem[] = localContinue.map((item) => {
    const targetPath =
      item.contentType === 'movie'
        ? `/watch/movie/${item.contentSlug}`
        : `/watch/series/${item.seriesSlug || item.contentSlug}/${item.seasonNumber || 1}/${item.episodeNumber || 1}`;

    return {
      id: `${item.contentId}_${item.episodeId || ''}`,
      contentId: item.contentId,
      episodeId: item.episodeId,
      title: item.title,
      posterUrl: item.posterUrl,
      type: item.contentType,
      slug: item.contentSlug,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      progressPct: item.percentage || 0,
      targetPath,
    };
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

  // All Latest Content (Sorted by actual theatrical and digital release date)
  const { data: allContentData, isLoading: isAllLoading } = useQuery({
    queryKey: ['all-latest-content'],
    queryFn: () => fetchContentList({ sort: 'latest', limit: 20 }),
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
        authContinueItems.length > 0 && (
          <ContinueWatchingCarousel
            items={authContinueItems}
            onRemoveItem={handleRemoveContinueItem}
          />
        )
      ) : (
        localContinueItems.length > 0 && (
          <ContinueWatchingCarousel
            items={localContinueItems}
            isAnonymous={true}
            onRemoveItem={handleRemoveContinueItem}
          />
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
            subtitle="Sorted by actual release date — newest theatrical & digital premieres first"
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
