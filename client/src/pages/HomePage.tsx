import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchContentList, fetchContinueWatching, fetchGenres, deleteHistoryItemApi, fetchRecommendations } from '../services/api';
import { HeroBanner } from '../components/HeroBanner';
import { HorizontalCarousel } from '../components/HorizontalCarousel';
import { ContinueWatchingCarousel, ContinueWatchingItem } from '../components/ContinueWatchingCarousel';
import { RecommendationSection } from '../components/RecommendationSection';
import { SkeletonCard, SkeletonGrid } from '../components/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import { getLocalPlaybackHistory, removeLocalPlaybackItem, getLocalInterests, getLocalFavorites, getLocalWatchlist } from '../utils/localStorage';
import { LocalPlaybackState } from '../types';
import { Play, TrendingUp, Flame, Tv, Sparkles, Clock, Compass, Coins, Wallet, Crown, Zap, ShieldCheck } from 'lucide-react';
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

  // Personalized Recommendations Query (combining auth profile or anonymous signals)
  const localInterests = getLocalInterests();
  const localWatchlist = getLocalWatchlist();
  const localFavorites = getLocalFavorites();

  const {
    data: recommendationsData,
    isLoading: isRecsLoading,
    refetch: refetchRecs,
  } = useQuery({
    queryKey: [
      'personalized-recommendations',
      user?.id,
      user?.preferredGenres?.join(',') || '',
      localContinue.length,
      localFavorites.length,
      localWatchlist.length,
      localInterests.join(','),
    ],
    queryFn: () =>
      fetchRecommendations({
        genres: user?.preferredGenres && user.preferredGenres.length > 0 ? user.preferredGenres : localInterests,
        historyIds: user ? undefined : localContinue.map((c) => c.contentId),
        favoriteIds: user ? undefined : localFavorites,
        watchlistIds: user ? undefined : localWatchlist,
        limit: 15,
      }),
    staleTime: 30 * 1000,
  });

  // Check if user has existing watch history or explicit interest signals
  const hasWatchHistory = Boolean(
    (user && authContinueItems.length > 0) ||
    (!user && localContinueItems.length > 0) ||
    (recommendationsData && !recommendationsData.isColdStart)
  );

  // Multi-item Hero Carousel:
  // - First-time users without history: features trending new movies & series
  // - Returning viewers with history: features tailored personalized recommendations
  const { heroItems, heroBadgeText } = React.useMemo(() => {
    // If user has active viewing history and personalized recommendations are ready
    if (hasWatchHistory && recommendationsData?.topPicks && recommendationsData.topPicks.length > 0) {
      return {
        heroItems: recommendationsData.topPicks.slice(0, 8),
        heroBadgeText: 'Recommended For You',
      };
    }

    // For first-time users without history: interleave trending new movies and series
    const trendingMovies = trendingMoviesData?.items || [];
    const trendingSeries = trendingSeriesData?.items || [];
    const latestItems = allContentData?.items || [];

    const trendingNewMixed: any[] = [];
    const seen = new Set<string>();

    const maxLen = Math.max(trendingMovies.length, trendingSeries.length, latestItems.length);
    for (let i = 0; i < maxLen; i++) {
      if (trendingMovies[i] && !seen.has(trendingMovies[i]._id)) {
        seen.add(trendingMovies[i]._id);
        trendingNewMixed.push(trendingMovies[i]);
      }
      if (trendingSeries[i] && !seen.has(trendingSeries[i]._id)) {
        seen.add(trendingSeries[i]._id);
        trendingNewMixed.push(trendingSeries[i]);
      }
      if (latestItems[i] && !seen.has(latestItems[i]._id)) {
        seen.add(latestItems[i]._id);
        trendingNewMixed.push(latestItems[i]);
      }
      if (trendingNewMixed.length >= 8) break;
    }

    return {
      heroItems: trendingNewMixed,
      heroBadgeText: '🔥 Trending Movies & Series',
    };
  }, [hasWatchHistory, recommendationsData, trendingMoviesData, trendingSeriesData, allContentData]);

  const isLoading = isFeaturedLoading && isAllLoading && isRecsLoading;

  return (
    <div className="min-h-screen bg-dark-base text-white pb-24 md:pb-16 space-y-6 sm:space-y-8">
      {/* Hero Banner Section (Auto-scrolling carousel: trending new titles for first-timers, recommendations for viewers with history) */}
      {heroItems.length > 0 ? (
        <HeroBanner items={heroItems} badgeText={heroBadgeText} autoPlayInterval={5500} />
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

      {/* Personalized Recommendations Section */}
      <RecommendationSection
        data={recommendationsData}
        isLoading={isRecsLoading}
        onRefresh={refetchRecs}
        availableGenres={genresData?.genres}
      />

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

      {/* Premium Features & CineCoins Loyalty Program */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950/60 via-dark-card to-dark-surface p-6 sm:p-10">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-brand-400" />
              <span className="text-brand-300 text-xs font-bold uppercase tracking-widest">Premium Features</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-3 tracking-tight">
              Watch Movies. Earn <span className="text-brand-400">CineCoins</span>. Get Real Money.
            </h2>
            <p className="text-gray-300 text-sm sm:text-base mb-6 max-w-2xl">
              Every 30 minutes you actively watch a movie or series, we credit <b className="text-brand-300">2 CineCoins</b> to
              your account. 1 CineCoin = <b className="text-brand-300">₹1 real money</b>. Buy any subscription plan
              and cash out directly to your UPI wallet.
            </p>

            {/* Rate + rules badges */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/30 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-bold">30 min = 2 coins</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/30 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-white font-bold">1 coin = ₹1</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/30 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span className="text-white font-bold">Pause / hide tab = no coins</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/30 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-brand-400" />
                <span className="text-white font-bold">Our buffering still counts</span>
              </div>
            </div>

            {/* How it works - 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-dark-base/60 border border-dark-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mb-3 font-bold">1</div>
                <div className="text-white font-bold mb-1">Sign in</div>
                <p className="text-gray-400 text-xs leading-relaxed">Create a free account so we can store the CineCoins you earn.</p>
              </div>
              <div className="bg-dark-base/60 border border-dark-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mb-3 font-bold">2</div>
                <div className="text-white font-bold mb-1">Watch actively</div>
                <p className="text-gray-400 text-xs leading-relaxed">Press play on any movie or episode. Keep the tab visible. Every 30 min of active watching = +2 coins.</p>
              </div>
              <div className="bg-dark-base/60 border border-dark-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mb-3 font-bold">3</div>
                <div className="text-white font-bold mb-1">Buy a plan</div>
                <p className="text-gray-400 text-xs leading-relaxed">Subscription unlocks redemption. Your coins stay safe even if the plan expires.</p>
              </div>
              <div className="bg-dark-base/60 border border-dark-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mb-3 font-bold">4</div>
                <div className="text-white font-bold mb-1">Cash out to UPI</div>
                <p className="text-gray-400 text-xs leading-relaxed">Enter your UPI ID, we process the payout and track it in your dashboard.</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 transition"
                >
                  <Wallet className="w-4 h-4" />
                  Go to my Profile ({user.cineCoins || 0} coins)
                </Link>
              ) : (
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 transition"
                >
                  <Coins className="w-4 h-4" />
                  Sign in to start earning
                </Link>
              )}
              <Link
                to="/profile#plans"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-border/60 hover:bg-dark-border border border-dark-border text-white font-semibold transition"
              >
                <Crown className="w-4 h-4 text-yellow-400" />
                View subscription plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
