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
    <div className="relative w-full h-[70vh] min-h-[520px] max-h-[750px] overflow-hidden bg-dark-base">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0">
        <img
          src={item.backdropUrl}
          alt={item.title}
          className="w-full h-full object-cover object-top opacity-60 filter brightness-90"
        />
        {/* Dark Vignette & Bottom Blending Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-base via-dark-base/70 to-transparent w-full md:w-3/4" />
      </div>

      {/* Hero Content Overlay */}
      <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 z-10">
        <div className="max-w-2xl space-y-4 animate-fade-in">
          {/* Featured Badge */}
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 bg-brand-500/90 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-brand-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Featured Release</span>
            </span>

            <span className="bg-black/60 backdrop-blur-md text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center space-x-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{item.rating?.toFixed(1) || '8.8'}</span>
            </span>

            <span className="bg-black/60 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-white/10 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{item.releaseYear}</span>
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-md leading-tight">
            {item.title}
          </h1>

          {/* Metadata details */}
          <div className="flex items-center space-x-3 text-xs sm:text-sm text-gray-300 font-medium">
            <span className="uppercase tracking-wider px-2 py-0.5 border border-gray-600 rounded">
              {item.type}
            </span>
            <span>•</span>
            <span>{item.genres?.join(' / ')}</span>
            <span>•</span>
            <span>{item.languages?.join(', ')}</span>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm sm:text-base line-clamp-3 leading-relaxed max-w-xl">
            {item.description}
          </p>

          {/* Call-to-action buttons */}
          <div className="flex items-center space-x-4 pt-2">
            <button
              onClick={handleWatchClick}
              className="flex items-center space-x-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold px-7 py-3 rounded-xl shadow-xl shadow-brand-500/30 transition-all hover:scale-105"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Watch Now</span>
            </button>

            <button
              onClick={handleWatchClick}
              className="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl backdrop-blur-md transition-all hover:scale-105"
            >
              <Info className="w-5 h-5" />
              <span>More Details</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
