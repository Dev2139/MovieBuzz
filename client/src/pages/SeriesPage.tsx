import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchSeries, fetchGenres } from '../services/api';
import { MediaCard } from '../components/MediaCard';
import { FilterDrawer } from '../components/FilterDrawer';
import { SkeletonGrid } from '../components/SkeletonCard';
import { Tv } from 'lucide-react';

export const SeriesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedGenre, setSelectedGenre] = useState<string>(searchParams.get('genre') || '');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(searchParams.get('language') || '');
  const [selectedYear, setSelectedYear] = useState<string>(searchParams.get('year') || '');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [page, setPage] = useState<number>(1);

  const { data: genresData } = useQuery({
    queryKey: ['genres-list'],
    queryFn: fetchGenres,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['series-catalog', selectedGenre, selectedLanguage, selectedYear, sortBy, page],
    queryFn: () =>
      fetchSeries({
        genre: selectedGenre || undefined,
        language: selectedLanguage || undefined,
        year: selectedYear || undefined,
        sort: sortBy,
        page,
        limit: 20,
      }),
  });

  const handleReset = () => {
    setSelectedGenre('');
    setSelectedLanguage('');
    setSelectedYear('');
    setSortBy('latest');
    setSearchParams({});
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-dark-base text-white pt-20 sm:pt-24 pb-24 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-500/20 border border-brand-500/40 rounded-xl flex items-center justify-center text-brand-500">
          <Tv className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">TV Series & Shows</h1>
          <p className="text-xs text-gray-400">Stream seasonal episodes with instant playback and quality downloads</p>
        </div>
      </div>

      <FilterDrawer
        selectedGenre={selectedGenre}
        setSelectedGenre={setSelectedGenre}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        sortBy={sortBy}
        setSortBy={setSortBy}
        genresList={genresData?.genres || []}
        onReset={handleReset}
      />

      {isLoading ? (
        <SkeletonGrid count={10} />
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
            {data.items.map((series) => (
              <div key={series._id} className="flex justify-center">
                <MediaCard item={series} />
              </div>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex justify-center space-x-2 pt-4">
              {Array.from({ length: data.totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                    page === i + 1
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                      : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl p-6">
          <p className="text-lg font-semibold text-white">No Series Found</p>
          <p className="text-xs mt-1">Try changing your filter selections.</p>
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl active:scale-95"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
