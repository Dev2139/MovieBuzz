import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Content } from '../types';
import { Play, Info, Star, Calendar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroBannerProps {
  items?: Content[];
  item?: Content;
  autoPlayInterval?: number; // In milliseconds (default: 6000)
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items: rawItems,
  item: singleItem,
  autoPlayInterval = 6000,
}) => {
  const navigate = useNavigate();

  // Normalize items array
  const items = React.useMemo(() => {
    if (rawItems && rawItems.length > 0) return rawItems;
    if (singleItem) return [singleItem];
    return [];
  }, [rawItems, singleItem]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Keep index within bounds if items change
  useEffect(() => {
    if (currentIndex >= items.length) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  const nextSlide = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  // Auto-scrolling timer with pause on hover
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [items.length, isPaused, autoPlayInterval, nextSlide]);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swiped left -> next slide
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      // Swiped right -> prev slide
      prevSlide();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  const handleDirectWatch = (item: Content) => {
    if (item.type === 'movie') {
      navigate(`/watch/movie/${item.slug}`);
    } else {
      navigate(`/watch/series/${item.slug}/1/1`);
    }
  };

  const handleDetailsClick = (item: Content) => {
    if (item.type === 'movie') {
      navigate(`/movie/${item.slug}`);
    } else {
      navigate(`/series/${item.slug}`);
    }
  };

  return (
    <div
      className="relative w-full h-[58vh] sm:h-[70vh] max-h-[760px] min-h-[460px] overflow-hidden bg-dark-base select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides with crossfade */}
      {items.map((slide, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={slide._id || idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
          >
            <img
              src={slide.backdropUrl || slide.posterUrl}
              alt={slide.title}
              className="w-full h-full object-cover object-top filter brightness-90 transform scale-100 transition-transform duration-[6000ms] ease-out group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  slide.posterUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1600';
              }}
            />
          </div>
        );
      })}

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/40 to-transparent z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-dark-base via-dark-base/75 to-transparent w-full md:w-4/5 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent h-24 z-[1]" />

      {/* Hero Content Overlay (Keyed by current item for smooth entry animation) */}
      <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-12 sm:pb-16 z-10">
        <div key={currentItem._id || currentIndex} className="max-w-2xl space-y-3 sm:space-y-4 animate-fade-in">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-brand-600 to-red-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-brand-500/30">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Recommended For You</span>
            </span>

            {currentItem.rating > 0 && (
              <span className="bg-black/75 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center space-x-1">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{currentItem.rating.toFixed(1)}</span>
              </span>
            )}

            {currentItem.releaseYear > 0 && (
              <span className="bg-black/75 backdrop-blur-md text-gray-300 text-[10px] sm:text-xs px-2.5 py-1 rounded-full border border-white/10 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span>{currentItem.releaseYear}</span>
              </span>
            )}

            <span className="bg-white/10 backdrop-blur-md text-white font-extrabold uppercase tracking-wider text-[10px] px-2 py-1 rounded-md border border-white/15">
              {currentItem.type}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight drop-shadow-xl leading-tight line-clamp-2">
            {currentItem.title}
          </h1>

          {/* Genres */}
          {currentItem.genres && currentItem.genres.length > 0 && (
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-300 font-medium">
              <span className="truncate max-w-[280px] sm:max-w-none">
                {currentItem.genres.slice(0, 4).join(' • ')}
              </span>
            </div>
          )}

          {/* Description */}
          <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl drop-shadow-md">
            {currentItem.description}
          </p>

          {/* Call to Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={() => handleDirectWatch(currentItem)}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl shadow-xl shadow-brand-500/40 transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white ml-0.5" />
              <span>Watch Now</span>
            </button>

            <button
              onClick={() => handleDetailsClick(currentItem)}
              className="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>More Details</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Navigation Chevrons (desktop hover) */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Previous Slide"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white border border-white/15 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Next Slide"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white border border-white/15 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Auto-scroll Progress Indicators / Thumbnail Pill Selector */}
      {items.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-8 z-20 flex items-center space-x-2">
          {items.map((slide, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={slide._id || idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
                className={`relative h-2 rounded-full transition-all duration-300 overflow-hidden ${
                  isActive ? 'w-8 sm:w-12 bg-white/30' : 'w-2 sm:w-2.5 bg-white/20 hover:bg-white/50'
                }`}
              >
                {/* Active Progress Bar Countdown */}
                {isActive && (
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{
                      animation: isPaused ? 'none' : `heroProgress ${autoPlayInterval}ms linear forwards`,
                      width: isPaused ? '100%' : undefined,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Keyframe animation for progress indicator */}
      <style>{`
        @keyframes heroProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};
