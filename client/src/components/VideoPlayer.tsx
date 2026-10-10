import React, { useState } from 'react';
import { Server, Zap, AlertCircle, RefreshCw } from 'lucide-react';
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

export type CloudServer = 'autoembed' | 'vidsrc' | 'superembed' | 'vidlink';

interface ServerOption {
  id: CloudServer;
  name: string;
  badge: string;
  subtext: string;
  icon: string;
  color: string;
}

export const CLOUD_SERVERS: ServerOption[] = [
  {
    id: 'autoembed',
    name: 'Server 1 (AutoEmbed)',
    badge: 'Rapid 1080p',
    subtext: 'High-speed cloud stream • Zero buffer',
    icon: '🚀',
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  },
  {
    id: 'vidsrc',
    name: 'Server 2 (VidSrc)',
    badge: 'Ultra HD',
    subtext: 'Global CDN edge streaming',
    icon: '⚡',
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    id: 'superembed',
    name: 'Server 3 (Multi-Server)',
    badge: 'Multi-Audio',
    subtext: 'Hindi, Tamil & global audio tracks',
    icon: '🌐',
    color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  },
  {
    id: 'vidlink',
    name: 'Server 4 (VidLink)',
    badge: 'Clean HD',
    subtext: 'Smooth lightweight cloud mirror',
    icon: '✨',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
];

export const getCloudEmbedUrl = (
  server: CloudServer,
  tmdb?: number,
  imdb?: string,
  contentType: 'movie' | 'series' = 'movie',
  seasonNumber: number = 1,
  episodeNumber: number = 1
): string | null => {
  if (!tmdb && !imdb) return null;
  const isMovie = contentType === 'movie';
  const id = tmdb ? String(tmdb) : imdb!;
  const s = seasonNumber || 1;
  const e = episodeNumber || 1;

  switch (server) {
    case 'autoembed':
      return isMovie
        ? `https://player.autoembed.cc/embed/movie/${id}`
        : `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`;
    case 'vidsrc':
      return isMovie
        ? `https://vidsrc.to/embed/movie/${id}`
        : `https://vidsrc.to/embed/tv/${id}/${s}/${e}`;
    case 'superembed':
      if (tmdb) {
        return isMovie
          ? `https://multiembed.mov/?video_id=${tmdb}&tmdb=1`
          : `https://multiembed.mov/?video_id=${tmdb}&tmdb=1&s=${s}&e=${e}`;
      }
      return isMovie
        ? `https://multiembed.mov/?video_id=${imdb}&imdb=1`
        : `https://multiembed.mov/?video_id=${imdb}&imdb=1&s=${s}&e=${e}`;
    case 'vidlink':
      return isMovie
        ? `https://vidlink.pro/movie/${id}`
        : `https://vidlink.pro/tv/${id}/${s}/${e}`;
    default:
      return null;
  }
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  contentTitle,
  contentType,
  tmdbId,
  imdbId,
  seasonNumber = 1,
  episodeNumber = 1,
}) => {
  const [activeServer, setActiveServer] = useState<CloudServer>('autoembed');
  const [reloadKey, setReloadKey] = useState<number>(0);

  const hasId = Boolean(tmdbId || imdbId);
  const embedUrl = getCloudEmbedUrl(
    activeServer,
    tmdbId,
    imdbId,
    contentType,
    seasonNumber,
    episodeNumber
  );

  return (
    <div className="space-y-3 sm:space-y-4 select-none">
      {/* Aspect-Video Video Frame Container */}
      <div className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        {hasId && embedUrl ? (
          <iframe
            key={`${activeServer}-${tmdbId || imdbId}-${seasonNumber}-${episodeNumber}-${reloadKey}`}
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
              This title is missing a TMDB/IMDb ID in the database to stream through the free movie API.
            </p>
          </div>
        )}
      </div>

      {/* Cloud Streaming Server Selector Bar */}
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
                  <span>0 MB Server Bandwidth</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                If the stream buffers, shows an ad, or is blocked, switch to another cloud mirror below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-white bg-dark-surface px-2.5 py-1 rounded-lg border border-white/5 active:scale-95 transition-all w-fit"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload Stream</span>
          </button>
        </div>

        {/* Server Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CLOUD_SERVERS.map((server) => {
            const isSelected = activeServer === server.id;

            return (
              <button
                key={server.id}
                type="button"
                onClick={() => setActiveServer(server.id)}
                className={`relative group flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-b from-white/10 to-white/5 border-brand-500 shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50'
                    : 'bg-dark-surface/80 border-white/5 hover:border-white/20 hover:bg-dark-surface hover:-translate-y-0.5'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                )}

                <div className="flex items-center space-x-1.5 w-full">
                  <span className="text-sm">{server.icon}</span>
                  <span
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'
                    }`}
                  >
                    {server.name}
                  </span>
                </div>

                <div className="mt-1 flex items-center space-x-1.5 w-full">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                      isSelected ? server.color : 'text-gray-400 border-white/10 bg-white/5'
                    }`}
                  >
                    {server.badge}
                  </span>
                </div>

                <span className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                  {server.subtext}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong>Free Cloud API:</strong> Streams directly from global multi-edge CDNs. Multi-audio & subtitles supported.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
