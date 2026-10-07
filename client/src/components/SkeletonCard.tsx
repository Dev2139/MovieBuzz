import React from 'react';

interface SkeletonCardProps {
  aspectRatio?: 'poster' | 'backdrop';
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ aspectRatio = 'poster' }) => {
  return (
    <div className="flex-none w-36 sm:w-48 md:w-56 rounded-xl overflow-hidden bg-dark-card border border-dark-border/60 shadow animate-pulse">
      <div
        className={`w-full bg-dark-surface/80 ${
          aspectRatio === 'backdrop' ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-dark-surface rounded w-3/4" />
        <div className="flex items-center space-x-2">
          <div className="h-3 bg-dark-surface rounded w-1/4" />
          <div className="h-3 bg-dark-surface rounded w-1/3" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 10 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
