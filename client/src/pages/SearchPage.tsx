import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { searchCatalog, submitContentRequestApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MediaCard } from '../components/MediaCard';
import { SkeletonGrid } from '../components/SkeletonCard';
import { Search, Film, Tv, Play, X, Sparkles, Send, CheckCircle2, MessageSquarePlus } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series' | 'episodes'>('all');

  // Request title form states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestType, setRequestType] = useState<'movie' | 'series'>('movie');
  const [requestYear, setRequestYear] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['search-catalog', query],
    queryFn: () => searchCatalog(query),
    enabled: query.trim().length > 0,
  });

  const requestMutation = useMutation({
    mutationFn: submitContentRequestApi,
    onSuccess: (res) => {
      setRequestSuccess(true);
      showToast(res.message || 'Request submitted successfully!', 'success');
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setRequestSuccess(false);
      }, 2500);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to submit request', 'error');
    },
  });

  const handleClear = () => {
    setQuery('');
    setSearchParams({});
  };

  const handleOpenRequestModal = (prefillTitle?: string) => {
    setRequestTitle(prefillTitle || query || '');
    setRequestType('movie');
    setRequestYear('');
    setRequestNotes('');
    setRequestEmail(user?.email || '');
    setRequestSuccess(false);
    setIsRequestModalOpen(true);
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim()) {
      showToast('Please enter a title to request', 'error');
      return;
    }
    requestMutation.mutate({
      title: requestTitle.trim(),
      type: requestType,
      releaseYear: requestYear ? Number(requestYear) : undefined,
      notes: requestNotes.trim(),
      userName: user?.name,
      userEmail: user?.email || requestEmail.trim(),
    });
  };

  const movies = data?.movies || [];
  const series = data?.series || [];
  const episodes = data?.episodes || [];

  const totalResults = movies.length + series.length + episodes.length;

  return (
    <div className="min-h-screen bg-dark-base text-white pt-20 sm:pt-24 pb-24 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 select-none">
      {/* Header with Search and Request Title Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-3xl mx-auto">
        <div className="relative w-full">
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

        <button
          onClick={() => handleOpenRequestModal()}
          className="flex-none flex items-center space-x-1.5 px-4 py-3 sm:py-4 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/40 text-brand-400 hover:text-brand-300 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-brand-500/10 w-full sm:w-auto justify-center"
          title="Request a movie or series not listed"
        >
          <MessageSquarePlus className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />
          <span>Request Title</span>
        </button>
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
        <div className="py-16 sm:py-20 text-center text-gray-400 space-y-3">
          <Search className="w-10 h-10 sm:w-12 sm:h-12 text-brand-500 mx-auto opacity-40" />
          <p className="text-base sm:text-lg font-semibold text-white">Start typing to search CineStream catalog</p>
          <p className="text-xs max-w-md mx-auto">Find authorized movies, seasons, and episodes across all genres. If something is missing, request it!</p>
          <div className="pt-2">
            <button
              onClick={() => handleOpenRequestModal()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-brand-400 rounded-xl text-xs font-semibold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Can't find a title? Submit a Request</span>
            </button>
          </div>
        </div>
      ) : totalResults === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-10 text-center space-y-5 max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center mx-auto shadow-lg">
            <Search className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-bold text-white">No results found for "{query}"</h3>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
              This movie or series is not in our system yet. You can request it right now, and our team will add it!
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-dark-surface rounded-2xl border border-white/5 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Instant 1-Click Request</span>
              </span>
              <span className="text-[10px] text-brand-400 uppercase font-semibold">Sent to Admin</span>
            </div>

            <p className="text-xs text-gray-300">
              Request <strong>"{query}"</strong> to be uploaded and encoded into our streaming library.
            </p>

            <button
              onClick={() => handleOpenRequestModal(query)}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-brand-500/25 transition-all active:scale-95 flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Request "{query}" Now</span>
            </button>
          </div>
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

      {/* User Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <button
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 border-b border-dark-border pb-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Request Movie or Series</h3>
                <p className="text-[11px] text-gray-400">Can't find a title? We'll add it for you!</p>
              </div>
            </div>

            {requestSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-bold text-lg text-white">Request Received!</h4>
                <p className="text-xs text-gray-300 max-w-xs mx-auto">
                  Your request for <strong>"{requestTitle}"</strong> has been sent to our admin team. It will be processed and uploaded shortly!
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Movie / Series Title <span className="text-brand-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inception, Stranger Things..."
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Content Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestType('movie')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center space-x-1.5 ${
                        requestType === 'movie'
                          ? 'bg-brand-500 text-white border-brand-500 shadow'
                          : 'bg-dark-surface text-gray-300 border-dark-border hover:bg-dark-hover'
                      }`}
                    >
                      <Film className="w-4 h-4" />
                      <span>Movie</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('series')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center space-x-1.5 ${
                        requestType === 'series'
                          ? 'bg-brand-500 text-white border-brand-500 shadow'
                          : 'bg-dark-surface text-gray-300 border-dark-border hover:bg-dark-hover'
                      }`}
                    >
                      <Tv className="w-4 h-4" />
                      <span>TV Series</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Release Year</label>
                    <input
                      type="number"
                      placeholder="e.g. 2024"
                      value={requestYear}
                      onChange={(e) => setRequestYear(e.target.value)}
                      className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Your Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="To notify when live"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Notes / Preferred Language (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Hindi audio preferred, 1080p, specific season..."
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requestMutation.isPending}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all active:scale-95 flex items-center justify-center space-x-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{requestMutation.isPending ? 'Sending Request...' : 'Submit Request to Admin'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
