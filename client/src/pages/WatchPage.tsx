import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchContentBySlug,
  fetchSeriesEpisodeByNumber,
  fetchUserHistory,
  fetchContentList,
  fetchSimilarContent,
  resolveStreamingSourcesByTitle,
  fetchSeriesMovieBoxSeasonsEpisodes,
  fetchSubtitles,
} from '../services/api';
import { VideoPlayer } from '../components/VideoPlayer';
import { ChevronLeft, ChevronRight, List, Film, Tv, Play, Sparkles, Layers, RotateCcw } from 'lucide-react';
import { getLocalPlaybackItem } from '../utils/localStorage';
import { resolveMediaUrl, getDownloadUrl, wrapStreamWithCloudflare } from '../utils/url';
import { useAuth } from '../context/AuthContext';

export const WatchPage: React.FC = () => {
  const { user } = useAuth();
  const { slug, seriesSlug, season, episode } = useParams();
  const navigate = useNavigate();

  const isMovie = Boolean(slug);
  const isSeries = Boolean(seriesSlug && season && episode);

  const currentEpNum = Number(episode || 1);
  const currentSeasonNum = Number(season || 1);
  const [selectedDrawerSeason, setSelectedDrawerSeason] = useState<number>(currentSeasonNum);

  // Movie Watch Query
  const { data: movieData, isLoading: isMovieLoading } = useQuery({
    queryKey: ['watch-movie', slug],
    queryFn: () => fetchContentBySlug(slug!),
    enabled: isMovie,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Series Watch Query
  const { data: seriesData, isLoading: isSeriesLoading } = useQuery({
    queryKey: ['watch-series', seriesSlug, season, episode],
    queryFn: () => fetchSeriesEpisodeByNumber(seriesSlug!, Number(season!), Number(episode!)),
    enabled: isSeries,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // User History Query for authenticated saved playback position
  const { data: userHistoryData } = useQuery({
    queryKey: ['user-history', user?.id],
    queryFn: fetchUserHistory,
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  // Related Movies & Catalog Query (powered by Recommendation Engine)
  const activeLookupSlug = slug || seriesSlug;
  const { data: relatedData } = useQuery({
    queryKey: ['related-catalog', activeLookupSlug],
    queryFn: async () => {
      if (activeLookupSlug) {
        const sim = await fetchSimilarContent(activeLookupSlug, 10).catch(() => []);
        if (sim && sim.length > 0) return sim;
      }
      const fallback = await fetchContentList({ limit: 10 }).catch(() => ({ items: [] }));
      return fallback?.items || [];
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback title / year parsed from slug if content record is still loading or slug was unhyphenated
  const fallbackMovieTitle = slug
    ? decodeURIComponent(slug).replace(/(?:-|\s)\d{4}$/, '').replace(/-/g, ' ').trim()
    : undefined;
  const fallbackYearMatch = slug ? slug.match(/(?:^|-|\s)(\d{4})$/) : null;
  const fallbackYear = fallbackYearMatch ? parseInt(fallbackYearMatch[1], 10) : undefined;

  const fallbackSeriesTitle = seriesSlug
    ? decodeURIComponent(seriesSlug).replace(/(?:-|\s)\d{4}$/, '').replace(/-/g, ' ').trim()
    : undefined;
  const fallbackSeriesYearMatch = seriesSlug ? seriesSlug.match(/(?:^|-|\s)(\d{4})$/) : null;
  const fallbackSeriesYear = fallbackSeriesYearMatch ? parseInt(fallbackSeriesYearMatch[1], 10) : undefined;

  // MovieBox Dynamic Playback Source Resolution
  const rawTitle =
    (isMovie ? movieData?.content?.title : seriesData?.series?.title) ||
    (isMovie ? fallbackMovieTitle : fallbackSeriesTitle);
  const rawYear =
    (isMovie ? movieData?.content?.releaseYear : seriesData?.series?.releaseYear) ||
    (isMovie ? fallbackYear : fallbackSeriesYear);
  const rawImdbId = isMovie ? movieData?.content?.imdbId : seriesData?.series?.imdbId;
  const rawTmdbId = isMovie ? movieData?.content?.tmdbId : seriesData?.series?.tmdbId;

  const {
    data: movieboxData,
    isLoading: isMovieboxLoading,
    isFetching: isMovieboxFetching,
    refetch: refetchMoviebox,
  } = useQuery({
    queryKey: ['moviebox-sources', rawTitle, rawYear, isMovie ? 'movie' : 'series', currentSeasonNum, currentEpNum, rawImdbId, rawTmdbId],
    queryFn: () =>
      resolveStreamingSourcesByTitle(
        rawTitle!,
        rawYear,
        isMovie ? 'movie' : 'series',
        currentSeasonNum,
        currentEpNum,
        { imdbId: rawImdbId, tmdbId: rawTmdbId }
      ),
    enabled: Boolean(rawTitle),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch Full MovieBox Series Seasons & Episodes Catalog
  const seriesLookupTitle = isSeries ? (seriesData?.series?.title || seriesSlug?.replace(/-/g, ' ')) : undefined;
  const { data: movieboxSeriesData } = useQuery({
    queryKey: ['moviebox-series-episodes', seriesLookupTitle, rawYear],
    queryFn: () => fetchSeriesMovieBoxSeasonsEpisodes(seriesLookupTitle!, rawYear),
    enabled: Boolean(isSeries && seriesLookupTitle),
    staleTime: 15 * 60 * 1000,
  });

  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  // Determine active media & title parameters
  let contentTitle = '';
  let contentId = '';
  let episodeId: string | undefined = undefined;
  let posterUrl = '';
  let playlist: any[] = [];
  let seriesObj: any = null;
  let tmdbId: number | undefined = undefined;
  let imdbId: string | undefined = undefined;

  if (isMovie && movieData?.content) {
    contentTitle = movieData.content.title;
    contentId = movieData.content._id;
    posterUrl = movieData.content.posterUrl;
    tmdbId = movieData.content.tmdbId;
    imdbId = movieData.content.imdbId;
  } else if (isMovie && fallbackMovieTitle) {
    contentTitle = fallbackMovieTitle;
  } else if (isSeries) {
    seriesObj = seriesData?.series;
    contentTitle = `${seriesObj?.title || seriesLookupTitle || 'Series'} - S${season} E${episode}: ${seriesData?.episode?.title || `Episode ${episode}`}`;
    contentId = seriesObj?._id || '';
    episodeId = seriesData?.episode?._id;
    posterUrl = seriesData?.episode?.thumbnailUrl || seriesObj?.backdropUrl;
    playlist = seriesData?.playlist || [];
    tmdbId = seriesObj?.tmdbId;
    imdbId = seriesObj?.imdbId;
  }



  // Multi-season catalog according to MovieBox
  const effectivePlaylistSeasons = React.useMemo(() => {
    if (movieboxSeriesData?.seasons && movieboxSeriesData.seasons.length > 0) {
      return movieboxSeriesData.seasons;
    }
    return [
      {
        seasonNumber: currentSeasonNum,
        title: `Season ${currentSeasonNum}`,
        episodeCount: playlist.length || 1,
        episodes: playlist.map((p) => ({
          seasonNumber: currentSeasonNum,
          episodeNumber: p.episodeNumber,
          title: p.title || `Episode ${p.episodeNumber}`,
          duration: p.duration || 2700,
          thumbnailUrl: p.thumbnailUrl,
        })),
      },
    ];
  }, [movieboxSeriesData, playlist, currentSeasonNum]);

  const activeDrawerSeasonGroup =
    effectivePlaylistSeasons.find((s) => s.seasonNumber === selectedDrawerSeason) ||
    effectivePlaylistSeasons.find((s) => s.seasonNumber === currentSeasonNum) ||
    effectivePlaylistSeasons[0];

  const currentPlayingSeasonGroup =
    effectivePlaylistSeasons.find((s) => s.seasonNumber === currentSeasonNum) || effectivePlaylistSeasons[0];

  const prevEp = currentEpNum > 1 ? { episodeNumber: currentEpNum - 1 } : null;
  const nextEp =
    currentPlayingSeasonGroup && currentEpNum < currentPlayingSeasonGroup.episodeCount
      ? { episodeNumber: currentEpNum + 1 }
      : playlist.find((e) => e.episodeNumber === currentEpNum + 1);

  // High-Speed Direct Sources with stable memoization (Fast Edge CDN First, Catalog/Telegram Alternative)
  const effectiveMediaList: any[] = React.useMemo(() => {
    const list: any[] = [];
    const seenUrls = new Set<string>();

    // 1. TIER 1 (Primary): Fast High-Speed Edge CDN Sources (MovieBox DASH / HLS / MP4)
    if (movieboxData?.sources && movieboxData.sources.length > 0) {
      movieboxData.sources.forEach((s: any) => {
        const sUrl = s.streamUrl;
        if (sUrl && !seenUrls.has(sUrl)) {
          seenUrls.add(sUrl);
          list.push({
            _id: `src-${s.resourceId || s.quality}`,
            quality: s.quality,
            resolution: s.resolution,
            fileSize: s.fileSize,
            codecName: s.codecName,
            mimeType: s.format === 'DASH' ? 'application/dash+xml' : (s.mimeType || 'video/mp4'),
            format: s.format || 'MP4',
            provider: 'cinestream',
            providerMediaId: s.resourceId,
            streamUrl: sUrl,
            downloadUrl: sUrl,
            audioLang: s.audioLang || 'en',
            audioName: s.audioName || 'Original Audio',
            dubSubjectId: s.dubSubjectId,
            isOriginal: s.isOriginal,
          });
        }
      });
    }

    // 2. TIER 2: Direct catalog / Telegram media from database
    const catalogMedia = isMovie ? movieData?.media : seriesData?.media;
    if (catalogMedia && Array.isArray(catalogMedia) && catalogMedia.length > 0) {
      const telegramMedia = catalogMedia.filter((m: any) => {
        const url: string = m?.streamUrl || m?.downloadUrl || '';
        return Boolean(url && (m?.provider === 'telegram' || url.includes('/proxy-file/') || m?.providerMediaId));
      });

      telegramMedia.forEach((m: any, idx: number) => {
        const directUrl = m.streamUrl || m.downloadUrl || '';
        const streamUrl = wrapStreamWithCloudflare(directUrl);
        const dlUrl = getDownloadUrl(m, contentTitle);
        const qualityLabel = m.quality || '1080p';

        if (streamUrl && !seenUrls.has(streamUrl)) {
          seenUrls.add(streamUrl);
          list.push({
            _id: m._id || `src-${m.providerMediaId || idx}`,
            quality: `${qualityLabel} • High Speed`,
            resolution: m.resolution || qualityLabel,
            fileSize: m.fileSize || 'Standard',
            codecName: 'h264',
            mimeType: 'video/mp4',
            format: 'MP4',
            provider: 'cinestream',
            providerMediaId: m.providerMediaId,
            streamUrl,
            downloadUrl: dlUrl || streamUrl,
            audioLang: 'en',
            audioName: 'Original Audio',
            isOriginal: true,
          });
        }
      });

      // Any other direct media in catalog
      const otherDirect = catalogMedia.filter((m: any) => {
        const url: string = m?.streamUrl || m?.downloadUrl || '';
        return Boolean(url && m?.provider !== 'telegram' && !url.includes('/proxy-file/'));
      });
      otherDirect.forEach((m: any) => {
        const sUrl = wrapStreamWithCloudflare(m.streamUrl);
        if (sUrl && !seenUrls.has(sUrl)) {
          seenUrls.add(sUrl);
          list.push({
            _id: m._id,
            quality: m.quality || 'HD',
            resolution: m.resolution || 'Auto',
            fileSize: m.fileSize || 'Standard',
            codecName: 'auto',
            mimeType: m.mimeType || 'video/mp4',
            format: 'MP4',
            provider: m.provider || 'direct',
            streamUrl: sUrl,
            downloadUrl: m.downloadUrl || m.streamUrl,
            audioLang: 'en',
            audioName: 'Original Audio',
            isOriginal: true,
          });
        }
      });
    }

    return list;
  }, [movieData?.media, seriesData?.media, movieboxData?.sources, isMovie, contentTitle]);

  // Subtitles Query (resolves multi-language WebVTT tracks)
  const { data: subtitlesData } = useQuery({
    queryKey: ['subtitles-sources', imdbId, tmdbId, rawTitle, isMovie ? 'movie' : 'series', currentSeasonNum, currentEpNum],
    queryFn: () =>
      fetchSubtitles({
        imdbId,
        tmdbId,
        title: rawTitle,
        type: isMovie ? 'movie' : 'series',
        season: currentSeasonNum,
        episode: currentEpNum,
      }),
    enabled: Boolean(rawTitle || imdbId || tmdbId),
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000,
  });

  const effectiveSubtitles = React.useMemo(() => {
    if (subtitlesData?.subtitles && subtitlesData.subtitles.length > 0) {
      return subtitlesData.subtitles;
    }
    if (movieboxData?.subtitles && movieboxData.subtitles.length > 0) {
      return movieboxData.subtitles;
    }
    return [];
  }, [subtitlesData?.subtitles, movieboxData?.subtitles]);

  // Saved position lookup (Cloud authenticated history first, fallback to local storage)
  let initialPos = 0;
  if (user && userHistoryData?.history && contentId) {
    const match = userHistoryData.history.find(
      (h: any) =>
        h.contentId &&
        (h.contentId._id === contentId || h.contentId === contentId) &&
        (!episodeId || (h.episodeId && (h.episodeId._id === episodeId || h.episodeId === episodeId)))
    );
    if (match && match.progress > 0) {
      // If content was marked completed or progress is near the end, restart cleanly from 0
      const isNearEnd = Boolean(match.completed) || (match.duration > 0 && (match.progress >= match.duration - 20 || match.progress / match.duration > 0.92));
      if (!isNearEnd) {
        initialPos = match.progress;
      }
    }
  }

  if (!initialPos && contentId) {
    const localSavedItem = getLocalPlaybackItem(contentId, episodeId);
    if (localSavedItem && localSavedItem.position > 0) {
      const isNearEnd = (localSavedItem.percentage && localSavedItem.percentage >= 92) || (localSavedItem.duration > 0 && (localSavedItem.position >= localSavedItem.duration - 20 || localSavedItem.position / localSavedItem.duration > 0.92));
      if (!isNearEnd) {
        initialPos = localSavedItem.position;
      }
    }
  }

  // Early loading return ONLY after all hooks are evaluated
  if (isMovieLoading || isSeriesLoading) {
    return (
      <div className="min-h-screen bg-dark-base flex flex-col items-center justify-center text-gray-400 space-y-3">
        <Sparkles className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold">Loading Video Player...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base text-white pt-3 sm:pt-5 pb-20 md:pb-16 select-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* Navigation Breadcrumb & Source Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 px-2 sm:px-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-1 hover:text-white transition-colors bg-dark-card border border-dark-border px-2.5 py-1.5 rounded-lg active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* CineStream HD Stream Indicator & Player Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
              <Sparkles className="w-3 h-3" />
              <span>
                {effectiveMediaList[0]?.format === 'DASH' || effectiveMediaList[0]?.format === 'HLS'
                  ? 'CineStream Ultra HD'
                  : 'CineStream HD Direct'}
              </span>
            </span>

            <div className="flex items-center space-x-2 font-medium">
              <span className="text-brand-500 font-bold">{isMovie ? 'MOVIE' : 'SERIES EPISODE'}</span>
              <span>•</span>
              <span className="text-white truncate max-w-[150px] sm:max-w-xs">{contentTitle}</span>
            </div>
          </div>
        </div>

        {/* Reusable Video Player with Native CineStream Controls */}
        {isMovieboxLoading && effectiveMediaList.length === 0 ? (
          <div className="w-full aspect-video bg-dark-card border border-dark-border rounded-xl flex flex-col items-center justify-center space-y-3 p-6 text-center">
            <Sparkles className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-sm font-semibold text-white">Resolving High-Speed Stream...</p>
            <p className="text-xs text-gray-400 max-w-md">
              Connecting to secure media stream for "{contentTitle}". This usually takes a few seconds.
            </p>
          </div>
        ) : effectiveMediaList.length > 0 ? (
          <VideoPlayer
            key={`${contentId || 'stream'}-${episodeId || (isSeries ? `${season}-${episode}` : 'movie')}`}
            mediaList={effectiveMediaList}
            contentId={contentId}
            episodeId={episodeId}
            contentTitle={contentTitle}
            posterUrl={posterUrl}
            contentSlug={slug || seriesSlug || ''}
            contentType={isMovie ? 'movie' : 'series'}
            initialPosition={initialPos}
            tmdbId={tmdbId}
            imdbId={imdbId}
            seasonNumber={isSeries ? Number(season || 1) : 1}
            episodeNumber={isSeries ? Number(episode || 1) : 1}
            subtitles={effectiveSubtitles}
            dubs={movieboxData?.dubs || []}
            onEnded={() => {
              if (nextEp) {
                navigate(`/watch/series/${seriesSlug}/${season}/${nextEp.episodeNumber}`);
              }
            }}
          />
        ) : (
          <div className="w-full aspect-video bg-dark-card border border-dark-border rounded-xl flex flex-col items-center justify-center space-y-3 p-6 text-center">
            <Film className="w-10 h-10 text-gray-500" />
            <p className="text-sm font-semibold text-gray-300">No Streaming Sources Found</p>
            <p className="text-xs text-gray-500 max-w-md">
              We couldn't resolve a stream for "{contentTitle}". Please check back soon or try another title.
            </p>
            <button
              onClick={() => refetchMoviebox()}
              disabled={isMovieboxFetching}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 active:scale-95 rounded-lg shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isMovieboxFetching ? 'animate-spin' : ''}`} />
              <span>{isMovieboxFetching ? 'Resolving Stream...' : 'Retry Stream Resolution'}</span>
            </button>
          </div>
        )}

        {/* Compact Movie Details Section Below Player (Visible when not in fullscreen) */}
        {((isMovie && movieData?.content) || (isSeries && seriesObj)) && (
          <div className="space-y-6">
            {/* Compact Main Info Card */}
            <div className="bg-dark-card border border-dark-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden">
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

              <div className="flex flex-row gap-3 sm:gap-4 items-start relative z-10">
                {/* Compact Poster Thumbnail */}
                <div className="flex-none w-20 sm:w-28 md:w-32 aspect-[2/3] rounded-lg overflow-hidden border border-white/10 shadow-xl bg-dark-surface relative group">
                  <img
                    src={posterUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}
                    alt={contentTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
                    }}
                  />
                </div>

                {/* Compact Details Column */}
                <div className="flex-1 space-y-2 sm:space-y-2.5 min-w-0">
                  <div>
                    <h1 className="text-base sm:text-2xl font-bold text-white tracking-tight truncate">
                      {isMovie ? movieData?.content?.title : seriesObj?.title}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] text-brand-400 font-semibold mt-0.5">
                      {isMovie ? 'Feature Film' : `Series Season ${season}`} • {isMovie ? movieData?.content?.releaseYear : seriesObj?.releaseYear}
                    </p>
                  </div>

                  {/* Ratings Badges (IMDb, TMDB, OMDb) */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {/* IMDb Badge */}
                    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-[10px] sm:text-[11px]">
                      <span className="font-black text-amber-300">IMDb</span>
                      <span>★ {(movieData?.content?.rating || seriesObj?.rating) ? (movieData?.content?.rating || seriesObj?.rating)!.toFixed(1) : 'NR'}</span>
                    </div>

                    {/* TMDB Badge */}
                    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold text-[10px] sm:text-[11px]">
                      <span className="font-black text-cyan-300">TMDB</span>
                      <span>{(movieData?.content?.rating || seriesObj?.rating) ? `${Math.round((movieData?.content?.rating || seriesObj?.rating)! * 10)}%` : 'NR'}</span>
                    </div>

                    {/* OMDb Badge */}
                    <div className="hidden sm:flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-[11px]">
                      <span className="font-black text-emerald-300">OMDb</span>
                      <span>Verified</span>
                    </div>

                    {/* Release Year */}
                    <span className="px-2 py-0.5 rounded-md bg-dark-surface border border-dark-border text-gray-300 text-[10px] sm:text-[11px] font-medium">
                      {movieData?.content?.releaseYear || seriesObj?.releaseYear || 2024}
                    </span>
                  </div>

                  {/* Genres & Director Pills */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-0.5">
                    {(movieData?.content?.genres || seriesObj?.genres || ['Action', 'Drama']).slice(0, 3).map((genre: string) => (
                      <span
                        key={genre}
                        className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30 text-[9px] sm:text-[10px] font-medium"
                      >
                        {genre}
                      </span>
                    ))}

                    {(movieData?.content?.director || seriesObj?.director) && (
                      <span className="px-2 py-0.5 rounded-full bg-dark-surface text-gray-300 border border-dark-border text-[9px] sm:text-[10px] font-medium truncate max-w-[140px] sm:max-w-[160px]">
                        🎬 {movieData?.content?.director || seriesObj?.director}
                      </span>
                    )}
                  </div>

                  {/* Synopsis */}
                  <div className="pt-1 border-t border-dark-border/50">
                    <p className="text-[11px] sm:text-xs text-gray-300 leading-normal line-clamp-3 sm:line-clamp-4">
                      {movieData?.content?.description || seriesObj?.description || 'No detailed plot summary available for this title.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Compact Cast & Actors Section */}
              <div className="border-t border-dark-border/50 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                    <span>Top Cast & Actors</span>
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">TMDB / IMDb</span>
                </div>

                {/* Compact Cast Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {(
                    movieData?.content?.cast ||
                    seriesObj?.cast || [
                      'Leonardo DiCaprio',
                      'Joseph Gordon-Levitt',
                      'Elliot Page',
                      'Tom Hardy',
                      'Ken Watanabe',
                      'Cillian Murphy',
                    ]
                  ).slice(0, 6).map((actorName: string, idx: number) => {
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      actorName
                    )}&background=1e1b4b&color=38bdf8&size=150&bold=true&font-size=0.4`;

                    return (
                      <div
                        key={idx}
                        className="bg-dark-surface/80 border border-dark-border p-2 rounded-lg flex items-center space-x-2 truncate"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-none">
                          <img
                            src={avatarUrl}
                            alt={actorName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-white truncate">{actorName}</p>
                          <p className="text-[9px] text-gray-400 truncate">Cast</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Compact Download & Quality Options */}
              {effectiveMediaList && effectiveMediaList.length > 0 && (
                <div className="border-t border-dark-border/50 pt-3 space-y-2">
                  <h3 className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Film className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CineStream High-Speed Quality Streams & Downloads</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {effectiveMediaList.map((m: any) => (
                      <div
                        key={m._id}
                        className="bg-dark-surface border border-dark-border px-3 py-1.5 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 bg-brand-500 text-white font-bold text-[9px] rounded uppercase">
                            {m.quality}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-300">
                            {m.resolution} {m.fileSize ? `(${m.fileSize})` : ''}
                          </span>
                        </div>

                        <a
                          href={getDownloadUrl(m, contentTitle)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/40 text-emerald-300 hover:text-white rounded-md text-[11px] font-semibold transition-all"
                        >
                          Download MP4
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls & Episode Navigation for Series */}
        {isSeries && (
          <div className="bg-dark-card border border-dark-border/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">{seriesData?.episode?.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Season {season} • Episode {episode}
                </p>
              </div>

              {/* Episode Quick Switch Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {prevEp && (
                  <button
                    onClick={() => navigate(`/watch/series/${seriesSlug}/${season}/${prevEp.episodeNumber}`)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-dark-surface border border-dark-border hover:border-gray-500 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev (E{prevEp.episodeNumber})</span>
                  </button>
                )}

                {nextEp && (
                  <button
                    onClick={() => navigate(`/watch/series/${seriesSlug}/${season}/${nextEp.episodeNumber}`)}
                    className="flex items-center space-x-1 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/25 transition-all active:scale-95"
                  >
                    <span>Next (E{nextEp.episodeNumber})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-dark-surface border border-dark-border hover:border-gray-500 rounded-xl text-xs font-semibold text-brand-500 active:scale-95"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Episodes List</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed border-t border-dark-border/60 pt-3">
              {seriesData?.episode?.description || 'Enjoy high definition playback for this season episode.'}
            </p>

            {/* Playlist Drawer */}
            {isPlaylistOpen && (
              <div className="pt-3 border-t border-dark-border/60 space-y-3 animate-fade-in">
                {/* Season Switcher in Drawer if multiple seasons */}
                {effectivePlaylistSeasons.length > 1 && (
                  <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
                    {effectivePlaylistSeasons.map((s) => (
                      <button
                        key={s.seasonNumber}
                        onClick={() => setSelectedDrawerSeason(s.seasonNumber)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                          selectedDrawerSeason === s.seasonNumber
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                            : 'bg-dark-surface border border-dark-border text-gray-300 hover:bg-dark-hover'
                        }`}
                      >
                        Season {s.seasonNumber} ({s.episodeCount})
                      </button>
                    ))}
                  </div>
                )}

                {/* Episodes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {(activeDrawerSeasonGroup?.episodes || playlist).map((ep) => {
                    const isCurrent =
                      ep.episodeNumber === currentEpNum &&
                      activeDrawerSeasonGroup.seasonNumber === currentSeasonNum;
                    return (
                      <div
                        key={`drawer-s${activeDrawerSeasonGroup.seasonNumber}-e${ep.episodeNumber}`}
                        onClick={() =>
                          navigate(
                            `/watch/series/${seriesSlug}/${activeDrawerSeasonGroup.seasonNumber}/${ep.episodeNumber}`
                          )
                        }
                        className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer border transition-all active:scale-95 ${
                          isCurrent
                            ? 'bg-brand-500/20 border-brand-500 text-white shadow-md shadow-brand-500/20'
                            : 'bg-dark-surface border-dark-border hover:border-gray-500 text-gray-300'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-none ${
                            isCurrent ? 'bg-brand-500 text-white' : 'bg-black/40 text-gray-400'
                          }`}
                        >
                          {ep.episodeNumber}
                        </div>
                        <div className="flex-1 truncate">
                          <p className={`font-semibold text-xs truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                            {ep.title}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Season {activeDrawerSeasonGroup.seasonNumber} • {Math.floor((ep.duration || 2700) / 60)} mins
                          </p>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] bg-brand-500/30 border border-brand-500/50 text-brand-400 px-1.5 py-0.5 rounded font-bold">
                            Playing
                          </span>
                        ) : (
                          <Play className="w-3.5 h-3.5 text-gray-500 hover:text-white flex-none" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other Recommended Movies & Series Section */}
        <div className="space-y-4 pt-4 border-t border-dark-border">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
              <Film className="w-5 h-5 text-brand-500" />
              <span>More Movies & Series Like This</span>
            </h2>
            <Link to="/movies" className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              Explore All →
            </Link>
          </div>

          {(() => {
            const list: any[] = Array.isArray(relatedData) ? relatedData : ((relatedData as any)?.items || []);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {list.length > 0 ? (
                  list.map((item: any) => {
                    const targetPath = item.type === 'movie' ? `/watch/movie/${item.slug}` : `/watch/series/${item.slug}/1/1`;
                    return (
                      <div
                        key={item._id}
                        onClick={() => navigate(targetPath)}
                        className="group bg-dark-card border border-dark-border/80 hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.03] active:scale-95"
                      >
                        <div className="aspect-[2/3] w-full overflow-hidden bg-dark-surface relative">
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-9 h-9 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-xl">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/75 backdrop-blur-md text-amber-400 rounded text-[10px] font-bold">
                            ★ {item.rating && item.rating > 0 ? item.rating.toFixed(1) : 'NR'}
                          </div>
                        </div>
                        <div className="p-2.5">
                          <h4 className="font-bold text-white text-xs truncate group-hover:text-brand-400 transition-colors">
                            {item.title}
                          </h4>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                            <span>{item.releaseYear}</span>
                            <span className="uppercase font-semibold text-brand-400">{item.type}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center text-gray-400 text-xs">
                    Loading recommended movies...
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
