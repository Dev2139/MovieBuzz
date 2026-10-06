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
      const scrollAmount = direction === 'left' ? -600 : 600;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative space-y-3 py-4">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center space-x-2">
            {icon && <span className="text-brand-500">{icon}</span>}
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 bg-dark-card border border-dark-border hover:border-gray-500 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors shadow-md"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 bg-dark-card border border-dark-border hover:border-gray-500 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors shadow-md"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex space-x-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 py-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <MediaCard key={item._id} item={item} />
        ))}
      </div>
    </div>
  );
};
