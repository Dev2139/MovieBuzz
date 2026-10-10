import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Content } from '../types';
import { Play, Info, Star, Calendar, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  item: Content;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ item }) => {
  const navigate = useNavigate();

  const handleWatchClick = () => {
    if (item.type === 'movie') {
      navigate(`/movie/${item.slug}`);
    } else {
      navigate(`/series/${item.slug}`);
    }
  };

  return (
    <div className="relative w-full h-[52vh] sm:h-[65vh] max-h-[720px] min-h-[420px] overflow-hidden bg-dark-base select-none">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0">
        <img
          src={item.backdropUrl}
          alt={item.title}
          className="w-full h-full object-cover object-top opacity-60 filter brightness-95"
        />
        {/* Dark Vignette & Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-base via-dark-base/70 to-transparent w-full md:w-3/4" />
      </div>

      {/* Hero Content Overlay */}
      <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-8 sm:pb-14 z-10">
        <div className="max-w-2xl space-y-3 sm:space-y-4 animate-fade-in">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1 bg-brand-500/90 text-white text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg shadow-brand-500/30">
              <Sparkles className="w-3 h-3" />
              <span>Featured Release</span>
            </span>

            <span className="bg-black/70 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border border-white/10 flex items-center space-x-1">
              <Star className="w-3 h-3 fill-amber-400" />
              <span>{item.rating && item.rating > 0 ? item.rating.toFixed(1) : 'NR'}</span>
            </span>

            <span className="bg-black/70 text-gray-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-white/10 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{item.releaseYear}</span>
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight drop-shadow-md leading-tight">
            {item.title}
          </h1>

          {/* Metadata */}
          <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-gray-300 font-medium">
            <span className="uppercase tracking-wider px-1.5 py-0.5 border border-gray-600 rounded text-[10px]">
              {item.type}
            </span>
            <span>•</span>
            <span className="truncate max-w-[200px] sm:max-w-none">{item.genres?.join(' / ')}</span>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl">
            {item.description}
          </p>

          {/* Call to action buttons */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={handleWatchClick}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
              <span>Watch Now</span>
            </button>

            <button
              onClick={handleWatchClick}
              className="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl backdrop-blur-md transition-all active:scale-95 text-xs sm:text-sm"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Details</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
