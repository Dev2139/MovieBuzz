import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCatalog } from '../services/api';
import { MediaCard } from '../components/MediaCard';
import { SkeletonGrid } from '../components/SkeletonCard';
import { Search, Film, Tv, Play, X } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series' | 'episodes'>('all');

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['search-catalog', query],
    queryFn: () => searchCatalog(query),
    enabled: query.trim().length > 0,
  });

  const handleClear = () => {
    setQuery('');
    setSearchParams({});
  };

  const movies = data?.movies || [];
  const series = data?.series || [];
  const episodes = data?.episodes || [];

  const totalResults = movies.length + series.length + episodes.length;

  return (
    <div className="min-h-screen bg-dark-base text-white pt-20 sm:pt-24 pb-24 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Search Input Box */}
      <div className="relative max-w-3xl mx-auto">
        <input
          type="text"
          placeholder="Search movies, series, actors, genres..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchParams(e.target.value ? { q: e.target.value } : {});
          }}
          className="w-full bg-dark-card border-2 border-dark-border focus:border-brand-500 rounded-2xl pl-11 pr-11 py-3.5 sm:py-4 text-sm sm:text-lg text-white shadow-2xl focus:outline-none transition-all"
        />
        <Search className="absolute left-3.5 sm:left-4 top-4 sm:top-5 w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3.5 sm:right-4 top-3.5 sm:top-4 text-gray-400 hover:text-white p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs (Horizontal scrolling on mobile) */}
      {query && (
        <div className="flex items-center justify-between border-b border-dark-border pb-3 overflow-x-auto scrollbar-none">
          <div className="flex space-x-2">
            {[
              { id: 'all', label: `All (${totalResults})` },
              { id: 'movies', label: `Movies (${movies.length})` },
              { id: 'series', label: `Series (${series.length})` },
              { id: 'episodes', label: `Episodes (${episodes.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-brand-500 text-white shadow'
                    : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results Display */}
      {isLoading ? (
        <SkeletonGrid count={10} />
      ) : !query ? (
        <div className="py-16 sm:py-20 text-center text-gray-400 space-y-2">
          <Search className="w-10 h-10 sm:w-12 sm:h-12 text-brand-500 mx-auto opacity-40" />
          <p className="text-base sm:text-lg font-semibold text-white">Start typing to search CineStream catalog</p>
          <p className="text-xs">Find authorized movies, seasons, and episodes across all genres.</p>
        </div>
      ) : totalResults === 0 ? (
        <div className="py-16 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl p-6">
          <p className="text-lg font-semibold text-white">No results found for "{query}"</p>
          <p className="text-xs mt-1">Check spelling or try searching for another title or genre.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Movies Section */}
          {(activeTab === 'all' || activeTab === 'movies') && movies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-base sm:text-lg font-bold">
                <Film className="w-5 h-5 text-brand-500" />
                <span>Movies</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
                {movies.map((m) => (
                  <MediaCard key={m._id} item={m} />
                ))}
              </div>
            </div>
          )}

          {/* Series Section */}
          {(activeTab === 'all' || activeTab === 'series') && series.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-base sm:text-lg font-bold">
                <Tv className="w-5 h-5 text-brand-500" />
                <span>TV Series</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
                {series.map((s) => (
                  <MediaCard key={s._id} item={s} />
                ))}
              </div>
            </div>
          )}

          {/* Episodes Section */}
          {(activeTab === 'all' || activeTab === 'episodes') && episodes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-base sm:text-lg font-bold">
                <Play className="w-5 h-5 text-brand-500" />
                <span>Matching Season Episodes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {episodes.map((ep: any) => (
                  <div
                    key={ep._id}
                    onClick={() => {
                      const seriesSlug = ep.seriesId?.slug || 'series';
                      const seasonNum = ep.seasonId?.seasonNumber || 1;
                      navigate(`/watch/series/${seriesSlug}/${seasonNum}/${ep.episodeNumber}`);
                    }}
                    className="flex items-center space-x-3 p-3 bg-dark-card border border-dark-border hover:border-gray-500 rounded-xl cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <div className="w-20 aspect-video rounded-lg overflow-hidden bg-dark-surface relative flex-none">
                      <img src={ep.thumbnailUrl} alt={ep.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white" />
                      </div>
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] text-brand-500 font-bold">Episode {ep.episodeNumber}</p>
                      <h4 className="font-bold text-white text-xs sm:text-sm truncate">{ep.title}</h4>
                      <p className="text-[11px] text-gray-400 truncate">{ep.seriesId?.title || 'TV Series'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
