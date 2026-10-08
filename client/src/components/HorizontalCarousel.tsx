import React, { useRef } from 'react';
import { Content } from '../types';
import { MediaCard } from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalCarouselProps {
  title: string;
  subtitle?: string;
  items: Content[];
  icon?: React.ReactNode;
}

export const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({ title, subtitle, items, icon }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -450 : 450;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative space-y-3 py-3 sm:py-4">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center space-x-2">
            {icon && <span className="text-brand-500">{icon}</span>}
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          {subtitle && <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Scroll Arrows for Desktop */}
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

      <div
        ref={containerRef}
        className="flex space-x-3 sm:space-x-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 py-2 scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div key={item._id} className="snap-start flex-none">
            <MediaCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
};
