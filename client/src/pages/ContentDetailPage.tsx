import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchContentBySlug,
  fetchSeriesSeasons,
  fetchSeasonEpisodes,
  fetchMediaDownloadLink,
  toggleWatchlistApi,
  toggleFavoriteApi,
} from '../services/api';
import { Play, Download, Star, Calendar, Globe, Users, Film, Plus, Check, Heart, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLocalWatchlist, toggleLocalWatchlist, getLocalFavorites, toggleLocalFavorites } from '../utils/localStorage';
import { Season, Episode } from '../types';

export const ContentDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
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

  // Fetch Seasons if content type is 'series'
  const { data: seasonsData } = useQuery({
    queryKey: ['series-seasons', content?._id],
    queryFn: () => fetchSeriesSeasons(content!._id),
    enabled: !!content && content.type === 'series',
  });

  const seasons = seasonsData?.seasons || [];

  // Select first season by default
  const activeSeasonId = selectedSeasonId || (seasons.length > 0 ? seasons[0]._id : '');

  // Fetch Episodes for selected season
  const { data: episodesData } = useQuery({
    queryKey: ['season-episodes', activeSeasonId],
    queryFn: () => fetchSeasonEpisodes(activeSeasonId),
    enabled: !!activeSeasonId,
  });

  const episodes = episodesData?.episodes || [];

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
      const res = await toggleWatchlistApi(content._id);
      setInWatchlist(res.inWatchlist);
    } else {
      const res = toggleLocalWatchlist(content._id);
      setInWatchlist(res);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!content) return;
    if (user) {
      const res = await toggleFavoriteApi(content._id);
      setIsFavorite(res.isFavorite);
    } else {
      const res = toggleLocalFavorites(content._id);
      setIsFavorite(res);
    }
  };

  const handleDownloadClick = async (mediaId: string) => {
    try {
      const res = await fetchMediaDownloadLink(mediaId);
      setDownloadLinkInfo(res);
      setDownloadModalMediaId(mediaId);
    } catch {
      alert('Error initiating download link');
    }
  };

  if (isLoading || !content) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center text-gray-400">
        Loading details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base text-white pb-20">
      {/* Backdrop Banner Header */}
      <div className="relative w-full h-[65vh] min-h-[480px] max-h-[700px] bg-dark-surface">
        <img
          src={content.backdropUrl}
          alt={content.title}
          className="w-full h-full object-cover opacity-50 filter brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-base via-dark-base/70 to-transparent w-full md:w-3/4" />
      </div>

      {/* Main Content Details Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-64 relative z-10 space-y-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Poster Card */}
          <div className="flex-none w-56 sm:w-64 md:w-72 aspect-[2/3] rounded-2xl overflow-hidden bg-dark-card border-2 border-dark-border shadow-2xl mx-auto md:mx-0">
            <img src={content.posterUrl} alt={content.title} className="w-full h-full object-cover" />
          </div>

          {/* Details Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="bg-brand-500 text-white font-extrabold text-xs uppercase px-2.5 py-1 rounded">
                {content.type}
              </span>
              <span className="bg-dark-card border border-dark-border text-amber-400 text-xs font-bold px-2.5 py-1 rounded flex items-center space-x-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{content.rating?.toFixed(1) || '8.5'}</span>
              </span>
              <span className="text-gray-400 text-xs font-medium flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{content.releaseYear}</span>
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">{content.title}</h1>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {content.genres?.map((g) => (
                <span key={g} className="bg-dark-card border border-dark-border text-gray-300 px-3 py-1 rounded-lg">
                  {g}
                </span>
              ))}
            </div>

            <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-3xl">
              {content.description}
            </p>

            {/* Additional Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300 pt-2 border-t border-dark-border/60 max-w-xl">
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
            <div className="flex flex-wrap items-center gap-3 pt-4">
              {content.type === 'movie' ? (
                <button
                  onClick={() => navigate(`/watch/movie/${content.slug}`)}
                  className="flex items-center space-x-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold px-7 py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>Watch Movie Now</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const firstEp = episodes[0];
                    if (firstEp) {
                      navigate(`/watch/series/${content.slug}/1/${firstEp.episodeNumber}`);
                    } else {
                      navigate(`/watch/series/${content.slug}/1/1`);
                    }
                  }}
                  className="flex items-center space-x-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold px-7 py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>Start Series (S1 E1)</span>
                </button>
              )}

              <button
                onClick={handleWatchlistToggle}
                className={`flex items-center space-x-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
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
                className={`flex items-center space-x-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
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

        {/* Section for Movies: Qualities & Download Options */}
        {content.type === 'movie' && mediaList.length > 0 && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-brand-500" />
              <h3 className="text-xl font-bold text-white">Download Authorized Copies</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {mediaList.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-xl"
                >
                  <div>
                    <span className="font-bold text-white text-base">{m.quality}</span>
                    <p className="text-xs text-gray-400">{m.resolution} • {m.fileSize}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadClick(m._id)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500/20 hover:bg-brand-500 text-brand-500 hover:text-white border border-brand-500/40 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section for Series: Season Selector & Episodes List */}
        {content.type === 'series' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-dark-border pb-4">
              <h3 className="text-2xl font-bold text-white">Seasons & Episodes</h3>
              {seasons.length > 0 && (
                <div className="flex space-x-2 overflow-x-auto scrollbar-none">
                  {seasons.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => setSelectedSeasonId(s._id)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeSeasonId === s._id
                          ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                          : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
                      }`}
                    >
                      Season {s.seasonNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episodes List */}
            {episodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {episodes.map((ep) => (
                  <div
                    key={ep._id}
                    onClick={() => {
                      const seasonObj = seasons.find((s) => s._id === activeSeasonId);
                      const sNum = seasonObj ? seasonObj.seasonNumber : 1;
                      navigate(`/watch/series/${content.slug}/${sNum}/${ep.episodeNumber}`);
                    }}
                    className="group bg-dark-card border border-dark-border hover:border-gray-500 rounded-xl overflow-hidden cursor-pointer p-3 space-y-3 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-dark-surface relative">
                      <img
                        src={ep.thumbnailUrl || content.backdropUrl}
                        alt={ep.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center">
                        <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-brand-500 font-bold">
                        <span>Episode {ep.episodeNumber}</span>
                        <span className="text-gray-400 font-normal">{Math.floor(ep.duration / 60)} mins</span>
                      </div>
                      <h4 className="font-bold text-white text-sm line-clamp-1 mt-0.5">{ep.title}</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">{ep.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 bg-dark-card border border-dark-border rounded-xl">
                No episodes currently listed for this season.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Modal Dialog */}
      {downloadModalMediaId && downloadLinkInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 text-white space-y-4">
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
                <h3 className="font-bold text-lg">Authorized Download Link</h3>
                <p className="text-xs text-gray-400">{downloadLinkInfo.quality} • {downloadLinkInfo.fileSize}</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Your direct file download token has been generated through the platform backend server without exposing channel storage credentials.
            </p>
            <a
              href={downloadLinkInfo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="block w-full text-center py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all"
            >
              Start Direct Download ({downloadLinkInfo.fileSize})
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
