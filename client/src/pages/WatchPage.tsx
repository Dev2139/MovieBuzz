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
