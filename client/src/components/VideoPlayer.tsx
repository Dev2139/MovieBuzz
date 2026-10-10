import React, { useState } from 'react';
import { Server, AlertCircle, RefreshCw } from 'lucide-react';
import { Media } from '../types';

interface VideoPlayerProps {
  mediaList?: Media[];
  contentId: string;
  episodeId?: string;
  contentTitle: string;
  posterUrl: string;
  contentSlug: string;
  contentType: 'movie' | 'series';
  initialPosition?: number;
  onEnded?: () => void;
  tmdbId?: number;
  imdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface EmbedServer {
  id: string;
  name: string;
  getMovieUrl: (tmdbId: number | string) => string;
  getTvUrl: (tmdbId: number | string, season: number, episode: number) => string;
}

export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: "vidfast",
    name: "VidFast",
    getMovieUrl: (tmdbId) =>
      `https://vidfast.vc/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidfast.vc/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidlink",
    name: "VidLink",
    getMovieUrl: (tmdbId) =>
      `https://vidlink.pro/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidsrcpro",
    name: "VidSrc Pro",
    getMovieUrl: (tmdbId) =>
      `https://vidsrc.pro/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "upcloud",
    name: "UpCloud",
    getMovieUrl: (tmdbId) =>
      `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "peachify",
    name: "Peachify",
    getMovieUrl: (tmdbId) =>
      `https://peachify.top/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://peachify.top/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidup",
    name: "VidUp",
    getMovieUrl: (tmdbId) =>
      `https://vidup.to/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidup.to/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidnest",
    name: "VidNest",
    getMovieUrl: (tmdbId) =>
      `https://vidnest.fun/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidrock",
    name: "VidRock",
    getMovieUrl: (tmdbId) =>
      `https://vidrock.net/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://vidrock.net/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    getMovieUrl: (tmdbId) =>
      `https://autoembed.co/movie/tmdb/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`,
  },
  {
    id: "videasy",
    name: "Videasy",
    getMovieUrl: (tmdbId) =>
      `https://player.videasy.net/movie/${tmdbId}`,
    getTvUrl: (tmdbId, season, episode) =>
      `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`,
  },
];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  contentTitle,
  contentType,
  tmdbId,
  imdbId,
  seasonNumber = 1,
  episodeNumber = 1,
}) => {
  const [activeServerId, setActiveServerId] = useState<string>(EMBED_SERVERS[0].id);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const hasId = Boolean(tmdbId || imdbId);
  const activeServerObj = EMBED_SERVERS.find((s) => s.id === activeServerId) || EMBED_SERVERS[0];

  const embedUrl = hasId
    ? contentType === 'movie'
      ? activeServerObj.getMovieUrl(tmdbId || imdbId!)
      : activeServerObj.getTvUrl(tmdbId || imdbId!, seasonNumber, episodeNumber)
    : null;

  return (
    <div className="space-y-3 sm:space-y-4 select-none">
      {/* Aspect-Video Video Frame Container */}
      <div className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        {hasId && embedUrl ? (
          <iframe
            key={`${activeServerId}-${tmdbId || imdbId}-${seasonNumber}-${episodeNumber}-${reloadKey}`}
            src={embedUrl}
            title={contentTitle}
            className="w-full h-full border-0 rounded-xl sm:rounded-2xl"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-dark-surface/90 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
              Metadata Match Required
            </h3>
            <p className="text-gray-400 text-xs max-w-md leading-relaxed mb-4">
              This title is missing a TMDB/IMDb ID in the database to stream through the media server.
            </p>
          </div>
        )}
      </div>

      {/* Discreet Server Selector Bar */}
      <div className="bg-dark-card/90 border border-dark-border/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-white text-xs sm:text-sm font-bold tracking-tight">Streaming Server</span>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>1080p Ultra HD</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                If a server buffers or is slow, switch to another server below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-white bg-dark-surface px-2.5 py-1 rounded-lg border border-white/5 active:scale-95 transition-all w-fit"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload Player</span>
          </button>
        </div>

        {/* Server Buttons Grid (Discreet Server 1 to Server 10 labels) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {EMBED_SERVERS.map((server, index) => {
            const isSelected = activeServerId === server.id;

            return (
              <button
                key={server.id}
                type="button"
                onClick={() => setActiveServerId(server.id)}
                className={`relative group flex items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-b from-brand-500/20 to-brand-500/10 border-brand-500 text-white shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50'
                    : 'bg-dark-surface/80 border-white/5 text-gray-300 hover:text-white hover:border-white/20 hover:bg-dark-surface'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs">⚡</span>
                  <span className="text-xs font-semibold">
                    Server {index + 1}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
