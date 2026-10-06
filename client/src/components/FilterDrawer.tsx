import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

interface FilterDrawerProps {
  selectedGenre: string;
  setSelectedGenre: (g: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (l: string) => void;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  genresList: string[];
  onReset: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  selectedGenre,
  setSelectedGenre,
  selectedLanguage,
  setSelectedLanguage,
  selectedYear,
  setSelectedYear,
  sortBy,
  setSortBy,
  genresList,
  onReset,
}) => {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-8 text-white shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-dark-border pb-3">
        <div className="flex items-center space-x-2 font-bold text-base">
          <Filter className="w-5 h-5 text-brand-500" />
          <span>Filter & Sort Catalog</span>
        </div>

        <button
          onClick={onReset}
          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors bg-dark-surface px-3 py-1.5 rounded-lg border border-dark-border"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Genre */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Genre
          </label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Genres</option>
            {genresList.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Languages</option>
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="Hindi">Hindi</option>
            <option value="Czech">Czech</option>
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Release Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="latest">Latest Added</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="title">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
