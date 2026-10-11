import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchContentBySlug,
  fetchSeriesSeasons,
  fetchSeasonEpisodes,
  fetchSeriesMovieBoxSeasonsEpisodes,
  fetchMediaDownloadLink,
  toggleWatchlistApi,
  toggleFavoriteApi,
} from '../services/api';
import { Play, Download, Star, Calendar, Globe, Users, Film, Plus, Check, Heart, X, Sparkles, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getLocalWatchlist, toggleLocalWatchlist, getLocalFavorites, toggleLocalFavorites } from '../utils/localStorage';
import { resolveMediaUrl } from '../utils/url';

export const ContentDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | 'all'>(1);
  const [downloadModalMediaId, setDownloadModalMediaId] = useState<string | null>(null);
  const [downloadLinkInfo, setDownloadLinkInfo] = useState<any | null>(null);

  // Fetch Content details by slug
  const { data, isLoading } = useQuery({
    queryKey: ['content-detail', slug],
    queryFn: () => fetchContentBySlug(slug!),
    enabled: !!slug,
  });

  const content = data?.content;
  const mediaList = data?.media || [];

  // Fetch Local MongoDB Seasons if content type is 'series'
  const { data: seasonsData } = useQuery({
    queryKey: ['series-seasons', content?._id],
    queryFn: () => fetchSeriesSeasons(content!._id),
    enabled: !!content && content.type === 'series',
  });

  const localSeasons = seasonsData?.seasons || [];

  // Fetch MovieBox Complete Seasons & Episodes Catalog
  const { data: movieboxSeriesData, isLoading: isMovieboxLoading } = useQuery({
    queryKey: ['moviebox-series-episodes', content?.title, content?.releaseYear],
    queryFn: () => fetchSeriesMovieBoxSeasonsEpisodes(content!.title, content?.releaseYear),
    enabled: !!content && content.type === 'series',
    staleTime: 15 * 60 * 1000,
  });

  // Build unified, complete season-wise episode list
  const effectiveSeasons = React.useMemo(() => {
    if (movieboxSeriesData?.seasons && movieboxSeriesData.seasons.length > 0) {
      return movieboxSeriesData.seasons.map((mbS) => ({
        seasonNumber: mbS.seasonNumber,
        title: mbS.title || `Season ${mbS.seasonNumber}`,
        episodeCount: mbS.episodeCount || mbS.episodes.length,
        episodes: mbS.episodes.map((mbEp) => ({
          seasonNumber: mbS.seasonNumber,
          episodeNumber: mbEp.episodeNumber,
          title: mbEp.title || `Episode ${mbEp.episodeNumber}`,
          description: mbEp.description || `${content?.title || 'Series'} Season ${mbS.seasonNumber} Episode ${mbEp.episodeNumber}`,
          thumbnailUrl: mbEp.thumbnailUrl || content?.backdropUrl || content?.posterUrl,
          duration: mbEp.duration || 2700,
        })),
      }));
    }

    if (localSeasons.length > 0) {
      return localSeasons.map((ls) => ({
        seasonNumber: ls.seasonNumber,
        title: ls.title || `Season ${ls.seasonNumber}`,
        episodeCount: 1,
        episodes: [
          {
            seasonNumber: ls.seasonNumber,
            episodeNumber: 1,
            title: `Episode 1`,
            description: `${content?.title || 'Series'} Season ${ls.seasonNumber}`,
            thumbnailUrl: ls.posterUrl || content?.backdropUrl || content?.posterUrl,
            duration: 2700,
          },
        ],
      }));
    }

    // Default Season 1 placeholder if series has no explicit list yet
    return [
      {
        seasonNumber: 1,
        title: 'Season 1',
        episodeCount: 1,
        episodes: [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            title: 'Episode 1',
            description: `${content?.title || 'Series'} Season 1 Episode 1`,
            thumbnailUrl: content?.backdropUrl || content?.posterUrl,
            duration: 2700,
          },
        ],
      },
    ];
  }, [movieboxSeriesData, localSeasons, content]);

  const totalEpisodesCount = effectiveSeasons.reduce((acc, s) => acc + s.episodeCount, 0);

  // Watchlist & Favorites state
  const [inWatchlist, setInWatchlist] = useState<boolean>(() => {
    if (!content) return false;
    if (user && user.watchlist) return user.watchlist.includes(content._id);
    return getLocalWatchlist().includes(content._id);
  });

  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    if (!content) return false;
    if (user && user.favorites) return user.favorites.includes(content._id);
    return getLocalFavorites().includes(content._id);
  });

  const handleWatchlistToggle = async () => {
    if (!content) return;
    if (user) {
      try {
        const res = await toggleWatchlistApi(content._id);
        setInWatchlist(res.inWatchlist);
        showToast(
          res.inWatchlist ? `Added "${content.title}" to Watchlist` : `Removed "${content.title}" from Watchlist`,
          'success'
        );
      } catch (err) {
        showToast('Failed to update watchlist', 'error');
      }
    } else {
      const res = toggleLocalWatchlist(content._id);
      setInWatchlist(res);
      showToast(
        res ? `Saved "${content.title}" to Watchlist` : `Removed "${content.title}" from Watchlist`,
        'success'
      );
    }
  };

  const handleFavoriteToggle = async () => {
    if (!content) return;
    if (user) {
      try {
        const res = await toggleFavoriteApi(content._id);
        setIsFavorite(res.isFavorite);
        showToast(
          res.isFavorite ? `Marked "${content.title}" as Favorite` : `Removed "${content.title}" from Favorites`,
          'success'
        );
      } catch (err) {
        showToast('Failed to update favorites', 'error');
      }
    } else {
      const res = toggleLocalFavorites(content._id);
      setIsFavorite(res);
      showToast(
        res ? `Marked "${content.title}" as Favorite` : `Removed "${content.title}" from Favorites`,
        'success'
      );
    }
  };

  const handleDownloadClick = async (mediaId: string) => {
    try {
      const res = await fetchMediaDownloadLink(mediaId);
      setDownloadLinkInfo(res);
      setDownloadModalMediaId(mediaId);
    } catch {
      showToast('Error initiating download link', 'error');
    }
  };

  if (isLoading || !content) {
    return (
      <div className="min-h-screen bg-dark-base flex flex-col items-center justify-center text-gray-400 space-y-3">
        <Sparkles className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold">Loading Title Details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base text-white pb-24 md:pb-16 select-none">
      {/* Backdrop Banner Header */}
      <div className="relative w-full h-[48vh] sm:h-[65vh] max-h-[650px] min-h-[360px] bg-dark-surface">
        <img
          src={content.backdropUrl}
          alt={content.title}
          className="w-full h-full object-cover opacity-50 filter brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-base via-dark-base/70 to-transparent w-full md:w-3/4" />
      </div>

      {/* Main Content Details Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-36 sm:-mt-56 relative z-10 space-y-8 sm:space-y-12">
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          {/* Poster Card */}
          <div className="flex-none w-44 sm:w-64 md:w-72 aspect-[2/3] rounded-2xl overflow-hidden bg-dark-card border-2 border-dark-border shadow-2xl mx-auto md:mx-0">
            <img src={content.posterUrl} alt={content.title} className="w-full h-full object-cover" />
          </div>

          {/* Details Info */}
          <div className="flex-1 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-brand-500 text-white font-extrabold text-[10px] sm:text-xs uppercase px-2 py-0.5 rounded">
                {content.type}
              </span>
              <span className="bg-dark-card border border-dark-border text-amber-400 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-1">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{content.rating && content.rating > 0 ? content.rating.toFixed(1) : 'NR'}</span>
              </span>
              <span className="text-gray-400 text-[10px] sm:text-xs font-medium flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{content.releaseYear}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {content.title}
            </h1>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold">
              {content.genres?.map((g) => (
                <span key={g} className="bg-dark-card border border-dark-border text-gray-300 px-2.5 py-1 rounded-lg">
                  {g}
                </span>
              ))}
            </div>

            <p className="text-gray-300 text-xs sm:text-base leading-relaxed max-w-3xl">
              {content.description}
            </p>

            {/* Additional Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs text-gray-300 pt-2 border-t border-dark-border/60 max-w-xl">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-brand-500" />
                <span>Languages: {content.languages?.join(', ')}</span>
              </div>
              {content.director && (
                <div className="flex items-center space-x-2">
                  <Film className="w-4 h-4 text-brand-500" />
                  <span>Director: {content.director}</span>
                </div>
              )}
              {content.cast && content.cast.length > 0 && (
                <div className="col-span-1 sm:col-span-2 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-brand-500" />
                  <span>Cast: {content.cast.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-3">
              {content.type === 'movie' ? (
                <button
                  onClick={() => navigate(`/watch/movie/${content.slug}`)}
                  className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 sm:px-7 py-2.5 sm:py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all active:scale-95 text-xs sm:text-sm"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                  <span>Watch Movie Now</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const firstEp = effectiveSeasons[0]?.episodes?.[0];
                    if (firstEp) {
                      navigate(`/watch/series/${content.slug}/${firstEp.seasonNumber}/${firstEp.episodeNumber}`);
                    } else {
                      navigate(`/watch/series/${content.slug}/1/1`);
                    }
                  }}
                  className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 sm:px-7 py-2.5 sm:py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all active:scale-95 text-xs sm:text-sm"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                  <span>Start Series (S1 E1)</span>
                </button>
              )}

              <button
                onClick={handleWatchlistToggle}
                className={`flex items-center space-x-1.5 px-4 py-2.5 sm:py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                  inWatchlist
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-dark-card border-dark-border text-gray-200 hover:bg-dark-hover'
                }`}
              >
                {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
              </button>

              <button
                onClick={handleFavoriteToggle}
                className={`flex items-center space-x-1.5 px-4 py-2.5 sm:py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                  isFavorite
                    ? 'bg-red-500/20 border-red-500 text-red-500'
                    : 'bg-dark-card border-dark-border text-gray-200 hover:bg-dark-hover'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                <span>Favorite</span>
              </button>
            </div>
          </div>
        </div>

        {/* Download Options for Movies */}
        {content.type === 'movie' && mediaList.length > 0 && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-brand-500" />
              <h3 className="text-lg sm:text-xl font-bold text-white">Download Authorized Copies</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mediaList.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center justify-between p-3.5 bg-dark-surface border border-dark-border rounded-xl"
                >
                  <div>
                    <span className="font-bold text-white text-sm sm:text-base">{m.quality}</span>
                    <p className="text-[11px] text-gray-400">{m.resolution} • {m.fileSize}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadClick(m._id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500 text-brand-500 hover:text-white border border-brand-500/40 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Series: Season Selector & Complete MovieBox Episodes Catalog */}
        {content.type === 'series' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border pb-3 gap-3">
              <div className="flex items-center space-x-3">
                <h3 className="text-xl sm:text-2xl font-bold text-white">Seasons & Episodes</h3>
                <span className="text-xs bg-brand-500/10 border border-brand-500/30 text-brand-400 font-bold px-2 py-0.5 rounded-full">
                  {effectiveSeasons.length} {effectiveSeasons.length === 1 ? 'Season' : 'Seasons'} • {totalEpisodesCount} Episodes
                </span>
                {isMovieboxLoading && (
                  <span className="flex items-center space-x-1 text-[11px] text-gray-400">
                    <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
                    <span>Syncing catalog...</span>
                  </span>
                )}
              </div>

              {/* Season Tabs with "All Seasons" option */}
              {effectiveSeasons.length > 0 && (
                <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
                  <button
                    onClick={() => setSelectedSeasonNumber('all')}
                    className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 flex items-center space-x-1.5 ${
                      selectedSeasonNumber === 'all'
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                        : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Seasons ({totalEpisodesCount})</span>
                  </button>

                  {effectiveSeasons.map((s) => (
                    <button
                      key={s.seasonNumber}
                      onClick={() => setSelectedSeasonNumber(s.seasonNumber)}
                      className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                        selectedSeasonNumber === s.seasonNumber
                          ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                          : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
                      }`}
                    >
                      Season {s.seasonNumber} ({s.episodeCount})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episodes List Display */}
            <div className="space-y-6">
              {effectiveSeasons
                .filter((s) => selectedSeasonNumber === 'all' || s.seasonNumber === selectedSeasonNumber)
                .map((seasonGroup) => (
                  <div key={seasonGroup.seasonNumber} className="space-y-3">
                    {selectedSeasonNumber === 'all' && (
                      <div className="flex items-center space-x-2 text-sm font-bold text-gray-300 pt-2 border-t border-dark-border/40">
                        <span className="w-2 h-2 rounded-full bg-brand-500" />
                        <span>Season {seasonGroup.seasonNumber} ({seasonGroup.episodeCount} Episodes)</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {seasonGroup.episodes.map((ep) => (
                        <div
                          key={`s${ep.seasonNumber}-e${ep.episodeNumber}`}
                          onClick={() => {
                            navigate(`/watch/series/${content.slug}/${ep.seasonNumber}/${ep.episodeNumber}`);
                          }}
                          className="group bg-dark-card border border-dark-border hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer p-3 space-y-2 sm:space-y-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex flex-col justify-between"
                        >
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-dark-surface relative flex-none">
                            <img
                              src={ep.thumbnailUrl || content.backdropUrl || content.posterUrl}
                              alt={ep.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                              <div className="w-9 h-9 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 fill-white ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                              S{ep.seasonNumber} E{ep.episodeNumber}
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between text-[11px] text-brand-500 font-bold mb-1">
                                <span>Episode {ep.episodeNumber}</span>
                                <span className="text-gray-400 font-normal">{Math.floor(ep.duration / 60)} mins</span>
                              </div>
                              <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">{ep.title}</h4>
                              <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">{ep.description}</p>
                            </div>

                            <button className="mt-2.5 w-full py-1.5 bg-dark-surface group-hover:bg-brand-500/20 text-gray-300 group-hover:text-brand-400 border border-dark-border group-hover:border-brand-500/40 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors">
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play Episode {ep.episodeNumber}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {effectiveSeasons.length === 0 && (
                <div className="py-12 text-center text-gray-400 bg-dark-card border border-dark-border rounded-xl text-xs space-y-2">
                  <Film className="w-8 h-8 text-gray-500 mx-auto" />
                  <p>No episodes currently found for this title.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Download Modal Dialog */}
      {downloadModalMediaId && downloadLinkInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-5 text-white space-y-4">
            <button
              onClick={() => setDownloadModalMediaId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-500/20 text-brand-500 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">Authorized Download Link</h3>
                <p className="text-xs text-gray-400">{downloadLinkInfo.quality} • {downloadLinkInfo.fileSize}</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Your direct file download token has been generated through the platform backend server without exposing channel storage credentials.
            </p>
            <a
              href={resolveMediaUrl(downloadLinkInfo.downloadUrl)}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="block w-full text-center py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/30 transition-all active:scale-95"
            >
              Start Direct Download ({downloadLinkInfo.fileSize})
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
