import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, ChevronLeft, ChevronRight, Star, X } from 'lucide-react';

export interface ContinueWatchingItem {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  posterUrl: string;
  backdropUrl?: string;
  type: 'movie' | 'series';
  slug: string;
  seasonNumber?: number;
  episodeNumber?: number;
  progressPct: number;
  rating?: number;
  releaseYear?: number;
  targetPath: string;
}

interface ContinueWatchingCarouselProps {
  items: ContinueWatchingItem[];
  isAnonymous?: boolean;
  onRemoveItem?: (item: ContinueWatchingItem, e: React.MouseEvent) => void;
}

export const ContinueWatchingCarousel: React.FC<ContinueWatchingCarouselProps> = ({
  items,
  isAnonymous = false,
  onRemoveItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -450 : 450;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative space-y-3 py-3 sm:py-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-brand-500" />
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Continue Watching</h2>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            Pick up right where you left off
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {isAnonymous && (
            <span className="text-[10px] sm:text-xs text-gray-400 bg-dark-card border border-dark-border px-2.5 py-1 rounded-full font-medium">
              Saved in Browser
            </span>
          )}

          {/* Desktop Left/Right Navigation Arrows */}
          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={() => scroll('left')}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-dark-card border border-dark-border hover:border-gray-500 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors shadow-md active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-dark-card border border-dark-border hover:border-gray-500 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors shadow-md active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={containerRef}
        className="flex space-x-3 sm:space-x-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 py-2 scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div key={item.id} className="snap-start flex-none">
            <div
              onClick={() => navigate(item.targetPath)}
              className="group relative flex-none w-36 sm:w-48 md:w-56 rounded-xl overflow-hidden bg-dark-card border border-dark-border/80 shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-gray-500 hover:shadow-2xl flex flex-col cursor-pointer"
            >
              {/* Media Poster Container */}
              <div className="block relative aspect-[2/3] w-full overflow-hidden bg-dark-surface">
                <img
                  src={item.posterUrl || item.backdropUrl}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Rating Badge or Progress Badge */}
                {item.rating ? (
                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center space-x-1 border border-white/10 shadow z-10">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-[11px] font-bold text-white">{item.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center space-x-1 border border-white/10 shadow z-10">
                    <span className="text-[11px] font-bold text-brand-400">{item.progressPct}%</span>
                  </div>
                )}

                {/* Type / Episode Badge */}
                <div className="absolute top-2 right-2 bg-brand-500/90 text-white font-extrabold text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded shadow z-10">
                  {item.episodeNumber ? `EP ${item.episodeNumber}` : item.type}
                </div>

                {/* Dismiss / Remove Button (on hover) */}
                {onRemoveItem && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item, e);
                    }}
                    className="absolute top-9 right-2 p-1.5 bg-black/80 hover:bg-red-600 text-gray-300 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md"
                    title="Remove from Continue Watching"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Play Resume Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-3">
                  <div className="w-11 h-11 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-500/40 transition-transform group-hover:scale-110 active:scale-95">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  <span className="text-white text-xs font-bold mt-2 drop-shadow">Resume</span>
                </div>

                {/* Netflix-style Progress Bar Pinned at Bottom of Poster */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/80 z-10">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 to-brand-500 shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                    style={{ width: `${Math.min(100, Math.max(3, item.progressPct))}%` }}
                  />
                </div>
              </div>

              {/* Card Info Below Poster */}
              <div className="p-2.5 flex-1 flex flex-col justify-between bg-dark-card border-t border-dark-border/40">
                <div>
                  <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-1 leading-snug group-hover:text-brand-500 transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center text-[10px] sm:text-[11px] text-gray-400 space-x-1.5 mt-0.5">
                    {item.episodeNumber ? (
                      <span className="text-brand-400 font-semibold">
                        S{item.seasonNumber || 1} E{item.episodeNumber}
                      </span>
                    ) : item.releaseYear ? (
                      <span>{item.releaseYear}</span>
                    ) : null}
                    {item.episodeNumber || item.releaseYear ? <span>•</span> : null}
                    <span>{item.progressPct}% watched</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
