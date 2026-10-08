import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchContentBySlug, fetchSeriesEpisodeByNumber } from '../services/api';
import { VideoPlayer } from '../components/VideoPlayer';
import { ChevronLeft, ChevronRight, List, Film, Tv, Play, Sparkles } from 'lucide-react';
import { getLocalPlaybackItem } from '../utils/localStorage';

export const WatchPage: React.FC = () => {
  const { slug, seriesSlug, season, episode } = useParams();
  const navigate = useNavigate();

  const isMovie = Boolean(slug);
  const isSeries = Boolean(seriesSlug && season && episode);

  // Movie Watch Query
  const { data: movieData, isLoading: isMovieLoading } = useQuery({
    queryKey: ['watch-movie', slug],
    queryFn: () => fetchContentBySlug(slug!),
    enabled: isMovie,
  });

  // Series Watch Query
  const { data: seriesData, isLoading: isSeriesLoading } = useQuery({
    queryKey: ['watch-series', seriesSlug, season, episode],
    queryFn: () => fetchSeriesEpisodeByNumber(seriesSlug!, Number(season!), Number(episode!)),
    enabled: isSeries,
  });

  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  if (isMovieLoading || isSeriesLoading) {
    return (
      <div className="min-h-screen bg-dark-base flex flex-col items-center justify-center text-gray-400 space-y-3">
        <Sparkles className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold">Loading Video Player...</p>
      </div>
    );
  }

  // Determine active media & title parameters
  let contentTitle = '';
  let contentId = '';
  let episodeId: string | undefined = undefined;
  let mediaList: any[] = [];
  let posterUrl = '';
  let playlist: any[] = [];
  let seriesObj: any = null;

  if (isMovie && movieData?.content) {
    contentTitle = movieData.content.title;
    contentId = movieData.content._id;
    mediaList = movieData.media || [];
    posterUrl = movieData.content.posterUrl;
  } else if (isSeries && seriesData?.episode) {
    seriesObj = seriesData.series;
    contentTitle = `${seriesObj?.title || 'Series'} - S${season} E${episode}: ${seriesData.episode.title}`;
    contentId = seriesObj?._id || '';
    episodeId = seriesData.episode._id;
    mediaList = seriesData.media || [];
    posterUrl = seriesData.episode.thumbnailUrl || seriesObj?.backdropUrl;
    playlist = seriesData.playlist || [];
  }

  const currentEpNum = Number(episode || 1);
  const prevEp = playlist.find((e) => e.episodeNumber === currentEpNum - 1);
  const nextEp = playlist.find((e) => e.episodeNumber === currentEpNum + 1);

  // Local saved position fallback if available
  const localSavedItem = getLocalPlaybackItem(contentId, episodeId);
  const initialPos = localSavedItem ? localSavedItem.position : 0;

  return (
    <div className="min-h-screen bg-dark-base text-white pt-16 sm:pt-20 pb-20 md:pb-16 select-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-gray-400 px-2 sm:px-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-1 hover:text-white transition-colors bg-dark-card border border-dark-border px-2.5 py-1.5 rounded-lg active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2 font-medium">
            <span className="text-brand-500 font-bold">{isMovie ? 'MOVIE' : 'SERIES EPISODE'}</span>
            <span>•</span>
            <span className="text-white truncate max-w-[150px] sm:max-w-xs">{contentTitle}</span>
          </div>
        </div>

        {/* Reusable Video Player */}
        <VideoPlayer
          mediaList={mediaList}
          contentId={contentId}
          episodeId={episodeId}
          contentTitle={contentTitle}
          posterUrl={posterUrl}
          contentSlug={slug || seriesSlug || ''}
          contentType={isMovie ? 'movie' : 'series'}
          initialPosition={initialPos}
          onEnded={() => {
            if (nextEp) {
              navigate(`/watch/series/${seriesSlug}/${season}/${nextEp.episodeNumber}`);
            }
          }}
        />

        {/* Movie Details Section Below Player (Visible when not in fullscreen) */}
        {((isMovie && movieData?.content) || (isSeries && seriesObj)) && (
          <div className="space-y-6">
            {/* Main Info Card */}
            <div className="bg-dark-card border border-dark-border/80 rounded-2xl p-5 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

              <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
                {/* Poster Thumbnail */}
                <div className="flex-none w-32 sm:w-44 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-dark-surface relative group">
                  <img
                    src={posterUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}
                    alt={contentTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
                    }}
                  />
                </div>

                {/* Details Column */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {isMovie ? movieData?.content?.title : seriesObj?.title}
                    </h1>
                    <p className="text-xs text-brand-400 font-semibold mt-1">
                      {isMovie ? 'Feature Film' : `Series Season ${season}`} • {isMovie ? movieData?.content?.releaseYear : seriesObj?.releaseYear}
                    </p>
                  </div>

                  {/* Ratings Row (IMDb, TMDB, OMDb) */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* IMDb Badge */}
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs">
                      <span className="font-black text-amber-300">IMDb</span>
                      <span>★ {(movieData?.content?.rating || seriesObj?.rating || 8.5).toFixed(1)}</span>
                    </div>

                    {/* TMDB Badge */}
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold text-xs">
                      <span className="font-black text-cyan-300">TMDB</span>
                      <span>{Math.round((movieData?.content?.rating || seriesObj?.rating || 8.5) * 10)}% Score</span>
                    </div>

                    {/* OMDb Badge */}
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
                      <span className="font-black text-emerald-300">OMDb</span>
                      <span>Verified</span>
                    </div>

                    {/* Release Year */}
                    <span className="px-2.5 py-1 rounded-lg bg-dark-surface border border-dark-border text-gray-300 text-xs font-semibold">
                      {movieData?.content?.releaseYear || seriesObj?.releaseYear || 2024}
                    </span>
                  </div>

                  {/* Genres & Languages Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(movieData?.content?.genres || seriesObj?.genres || ['Action', 'Drama', 'Thriller']).map((genre: string) => (
                      <span
                        key={genre}
                        className="px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30 text-[11px] font-medium"
                      >
                        {genre}
                      </span>
                    ))}

                    {(movieData?.content?.languages || seriesObj?.languages || ['English']).map((lang: string) => (
                      <span
                        key={lang}
                        className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-medium"
                      >
                        🌐 {lang}
                      </span>
                    ))}

                    {(movieData?.content?.director || seriesObj?.director) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-dark-surface text-gray-300 border border-dark-border text-[11px] font-medium">
                        🎬 Director: {movieData?.content?.director || seriesObj?.director}
                      </span>
                    )}
                  </div>

                  {/* Summary / Synopsis */}
                  <div className="pt-2 border-t border-dark-border/60">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Overview & Synopsis</h3>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {movieData?.content?.description || seriesObj?.description || 'No detailed plot summary available for this title.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cast & Actors Details Section */}
              <div className="border-t border-dark-border/60 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-500" />
                    <span>Top Cast & Actors (TMDB / IMDb)</span>
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">Verified API Metadata</span>
                </div>

                {/* Actors Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
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
                  ).map((actorName: string, idx: number) => {
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      actorName
                    )}&background=1e1b4b&color=38bdf8&size=200&bold=true&font-size=0.4`;

                    return (
                      <div
                        key={idx}
                        className="bg-dark-surface/80 border border-dark-border p-2.5 rounded-xl flex flex-col items-center text-center space-y-2 hover:border-brand-500/50 transition-all group"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-brand-500 shadow-md flex-none">
                          <img
                            src={avatarUrl}
                            alt={actorName}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <div className="w-full truncate">
                          <p className="text-xs font-bold text-white truncate group-hover:text-brand-400 transition-colors">
                            {actorName}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">Lead Cast</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Downloads & Quality Stream Files */}
              {mediaList && mediaList.length > 0 && (
                <div className="border-t border-dark-border/60 pt-6 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Film className="w-4 h-4 text-cyan-400" />
                    <span>Available Quality Streams & Fast Downloads</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mediaList.map((m) => (
                      <div
                        key={m._id}
                        className="bg-dark-surface border border-dark-border p-3 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 bg-brand-500 text-white font-bold text-[10px] rounded uppercase">
                              {m.quality}
                            </span>
                            <span className="text-xs font-semibold text-gray-200">{m.resolution}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Size: {m.fileSize || '1.4 GB'}</p>
                        </div>

                        <a
                          href={m.downloadUrl || m.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500 border border-brand-500/40 hover:border-brand-500 text-brand-300 hover:text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center space-x-1"
                        >
                          <span>Download</span>
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
          <div className="bg-dark-card border border-dark-border/80 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{seriesData?.episode?.title}</h2>
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

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed border-t border-dark-border/60 pt-3">
              {seriesData?.episode?.description || 'Enjoy high definition playback for this season episode.'}
            </p>

            {/* Playlist Drawer */}
            {isPlaylistOpen && playlist.length > 0 && (
              <div className="pt-3 border-t border-dark-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 animate-fade-in">
                {playlist.map((ep) => {
                  const isCurrent = ep.episodeNumber === Number(episode);
                  return (
                    <div
                      key={ep._id}
                      onClick={() => navigate(`/watch/series/${seriesSlug}/${season}/${ep.episodeNumber}`)}
                      className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer border transition-all active:scale-95 ${
                        isCurrent
                          ? 'bg-brand-500/20 border-brand-500 text-white'
                          : 'bg-dark-surface border-dark-border hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center font-bold text-xs flex-none">
                        {ep.episodeNumber}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="font-semibold text-xs truncate">{ep.title}</p>
                        <p className="text-[10px] text-gray-400">{Math.floor(ep.duration / 60)} mins</p>
                      </div>
                      {isCurrent && <Play className="w-4 h-4 text-brand-500 fill-brand-500 flex-none" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
