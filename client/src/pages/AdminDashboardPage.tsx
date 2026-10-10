import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchAdminStats,
  createMovieApi,
  createSeriesApi,
  deleteContentApi,
  updateContentApi,
  fetchAdminCatalogApi,
  fetchAdminRequestsApi,
  updateAdminRequestApi,
  deleteAdminRequestApi,
} from '../services/api';
import {
  Film,
  Tv,
  Users,
  Eye,
  Download,
  Plus,
  Trash2,
  Send,
  Layers,
  Sparkles,
  Edit2,
  X,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  MessageSquarePlus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'manage' | 'requests' | 'add-movie' | 'add-series'>('overview');

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
  });

  // Manage content catalog states & query
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [catalogPage, setCatalogPage] = useState(1);

  const { data: catalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['admin-catalog', catalogTypeFilter, catalogStatusFilter, catalogSearch, catalogPage],
    queryFn: () =>
      fetchAdminCatalogApi({
        type: catalogTypeFilter,
        status: catalogStatusFilter,
        search: catalogSearch,
        page: catalogPage,
        limit: 50,
      }),
  });

  // User Content Requests states & query
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('pending');
  const [requestSearch, setRequestSearch] = useState('');

  const { data: requestsData, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['admin-requests', requestStatusFilter, requestSearch],
    queryFn: () =>
      fetchAdminRequestsApi({
        status: requestStatusFilter,
        search: requestSearch,
      }),
  });

  const updateRequestMutation = useMutation({
    mutationFn: updateAdminRequestApi,
    onSuccess: (data) => {
      alert(data.message || 'Request updated');
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: deleteAdminRequestApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  // Movie Form State
  const [movieTitle, setMovieTitle] = useState('');
  const [movieDescription, setMovieDescription] = useState('');
  const [moviePoster, setMoviePoster] = useState('');
  const [movieBackdrop, setMovieBackdrop] = useState('');
  const [movieYear, setMovieYear] = useState('2026');
  const [movieGenres, setMovieGenres] = useState('Action, Sci-Fi');
  const [movieRating, setMovieRating] = useState('8.5');

  // Series Form State
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [seriesPoster, setSeriesPoster] = useState('');
  const [seriesBackdrop, setSeriesBackdrop] = useState('');
  const [seriesYear, setSeriesYear] = useState('2026');
  const [seriesGenres, setSeriesGenres] = useState('Drama, Sci-Fi');

  // Add Movie Mutation
  const addMovieMutation = useMutation({
    mutationFn: createMovieApi,
    onSuccess: () => {
      alert('Movie created successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
      setMovieTitle('');
      setMovieDescription('');
      setActiveTab('overview');
    },
  });

  // Add Series Mutation
  const addSeriesMutation = useMutation({
    mutationFn: createSeriesApi,
    onSuccess: () => {
      alert('Series created successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
      setSeriesTitle('');
      setSeriesDescription('');
      setActiveTab('overview');
    },
  });

  // Delete Content Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteContentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
  });

  // Edit Content State & Mutation
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'movie' | 'series'>('movie');
  const [editDescription, setEditDescription] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editBackdropUrl, setEditBackdropUrl] = useState('');
  const [editReleaseYear, setEditReleaseYear] = useState<number>(2026);
  const [editRating, setEditRating] = useState<number>(8.5);

  const updateMutation = useMutation({
    mutationFn: updateContentApi,
    onSuccess: (data) => {
      alert(`Updated successfully! "${data.content?.title || 'Item'}" (${data.content?.type || 'media'}) is now live across the site.`);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['existing-series-list'] });
      queryClient.invalidateQueries();
    },
  });

  const handleEditOpen = (item: any) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditType(item.type === 'series' ? 'series' : 'movie');
    setEditDescription(item.description || '');
    setEditPosterUrl(item.posterUrl || '');
    setEditBackdropUrl(item.backdropUrl || '');
    setEditReleaseYear(item.releaseYear || 2026);
    setEditRating(item.rating || 8.5);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    updateMutation.mutate({
      id: editingItem._id,
      data: {
        title: editTitle,
        type: editType,
        description: editDescription,
        posterUrl: editPosterUrl,
        backdropUrl: editBackdropUrl,
        releaseYear: editReleaseYear,
        rating: editRating,
      },
    });
  };

  const handleMovieSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMovieMutation.mutate({
      title: movieTitle,
      description: movieDescription,
      posterUrl: moviePoster || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
      backdropUrl: movieBackdrop || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600',
      releaseYear: Number(movieYear),
      genres: movieGenres,
      languages: 'English',
      rating: Number(movieRating),
      qualities: [
        {
          quality: '1080p',
          resolution: '1920x1080',
          fileSize: '1.4 GB',
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        },
      ],
    });
  };

  const handleSeriesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSeriesMutation.mutate({
      title: seriesTitle,
      description: seriesDescription,
      posterUrl: seriesPoster || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800',
      backdropUrl: seriesBackdrop || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600',
      releaseYear: Number(seriesYear),
      genres: seriesGenres,
      languages: 'English',
    });
  };

  const handleQuickAddFromRequest = (req: any) => {
    if (req.type === 'series') {
      setSeriesTitle(req.title);
      if (req.releaseYear) setSeriesYear(String(req.releaseYear));
      setActiveTab('add-series');
    } else {
      setMovieTitle(req.title);
      if (req.releaseYear) setMovieYear(String(req.releaseYear));
      setActiveTab('add-movie');
    }
  };

  return (
    <div className="min-h-screen bg-dark-base text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Console</h1>
          <p className="text-xs text-gray-400 mt-1">Platform management, content catalog, and Telegram channel imports</p>
        </div>

        <Link
          to="/admin/telegram"
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 transition-all"
        >
          <Send className="w-4 h-4" />
          <span>Telegram Import Queue ({stats?.pendingImports || 0})</span>
        </Link>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-dark-border pb-3">
        {[
          { id: 'overview', label: 'Dashboard Overview' },
          { id: 'requests', label: `User Requests (${stats?.pendingRequests || 0})` },
          { id: 'manage', label: `Manage Catalog (${catalog?.total || 0})` },
          { id: 'add-movie', label: 'Add New Movie' },
          { id: 'add-series', label: 'Add New Series' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow'
                : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Stats Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Total Movies</span>
                <Film className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalMovies || 0}</p>
            </div>

            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Total Series</span>
                <Tv className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalSeries || 0}</p>
            </div>

            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Episodes</span>
                <Layers className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalEpisodes || 0}</p>
            </div>

            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Users</span>
                <Users className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalUsers || 0}</p>
            </div>

            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Total Views</span>
                <Eye className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalViews?.toLocaleString() || 0}</p>
            </div>

            <div className="p-4 bg-dark-card border border-dark-border rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Downloads</span>
                <Download className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-black text-white">{stats?.totalDownloads?.toLocaleString() || 0}</p>
            </div>

            <div
              onClick={() => setActiveTab('requests')}
              className="p-4 bg-dark-card border border-amber-500/30 hover:border-amber-500/80 rounded-2xl space-y-1 cursor-pointer transition-all hover:bg-dark-hover"
            >
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-semibold uppercase">Requests</span>
                <MessageSquarePlus className="w-4 h-4" />
              </div>
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-black text-white">{stats?.pendingRequests || 0}</p>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Pending</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Telegram Channel Auto-Parser & Import Queue</h3>
              <p className="text-xs text-gray-400">
                Review detected media posts from your channel, correct parsed metadata, map to content/season/episodes, and publish to the live site.
              </p>
            </div>
            <Link
              to="/admin/telegram"
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow"
            >
              Open Telegram Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Add Movie Tab */}
      {activeTab === 'add-movie' && (
        <form onSubmit={handleMovieSubmit} className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-2xl space-y-4 animate-fade-in">
          <h3 className="text-xl font-bold text-white mb-2">Publish New Movie</h3>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Movie Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Cyberpunk Neon"
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
            <textarea
              required
              rows={3}
              placeholder="Synopsis..."
              value={movieDescription}
              onChange={(e) => setMovieDescription(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Poster Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={moviePoster}
                onChange={(e) => setMoviePoster(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Backdrop Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={movieBackdrop}
                onChange={(e) => setMovieBackdrop(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Year</label>
              <input
                type="number"
                value={movieYear}
                onChange={(e) => setMovieYear(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Genres</label>
              <input
                type="text"
                value={movieGenres}
                onChange={(e) => setMovieGenres(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Rating</label>
              <input
                type="text"
                value={movieRating}
                onChange={(e) => setMovieRating(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={addMovieMutation.isPending}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25"
          >
            {addMovieMutation.isPending ? 'Publishing...' : 'Publish Movie to Site'}
          </button>
        </form>
      )}

      {/* Add Series Tab */}
      {activeTab === 'add-series' && (
        <form onSubmit={handleSeriesSubmit} className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-2xl space-y-4 animate-fade-in">
          <h3 className="text-xl font-bold text-white mb-2">Publish New TV Series</h3>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Series Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Quantum Vanguard"
              value={seriesTitle}
              onChange={(e) => setSeriesTitle(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
            <textarea
              required
              rows={3}
              placeholder="Series storyline..."
              value={seriesDescription}
              onChange={(e) => setSeriesDescription(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Poster Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={seriesPoster}
                onChange={(e) => setSeriesPoster(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Backdrop Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={seriesBackdrop}
                onChange={(e) => setSeriesBackdrop(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={addSeriesMutation.isPending}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25"
          >
            {addSeriesMutation.isPending ? 'Publishing...' : 'Publish Series to Site'}
          </button>
        </form>
      )}

      {/* User Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-border pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <MessageSquarePlus className="w-5 h-5 text-amber-400" />
                <h3 className="text-xl font-bold text-white">User Content Requests</h3>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Titles requested by users when not found in our catalog. You can review, fulfill, or directly import them.
              </p>
            </div>

            {/* Request Status Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'pending', label: 'Pending', icon: Clock, count: stats?.pendingRequests || 0 },
                { id: 'fulfilled', label: 'Fulfilled', icon: CheckCircle2 },
                { id: 'rejected', label: 'Rejected', icon: Ban },
                { id: 'all', label: 'All Requests' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRequestStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    requestStatusFilter === f.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-dark-surface border border-dark-border text-gray-400 hover:text-white'
                  }`}
                >
                  {f.icon && <f.icon className="w-3.5 h-3.5" />}
                  <span>{f.label}</span>
                  {typeof f.count === 'number' && f.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search Requests */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search requested movie or series title, requester name or email..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Requests Content List */}
          {isRequestsLoading ? (
            <div className="text-center py-12 text-gray-400 text-xs">Loading content requests...</div>
          ) : !requestsData?.requests || requestsData.requests.length === 0 ? (
            <div className="text-center py-12 bg-dark-surface/50 border border-dark-border/50 rounded-2xl space-y-2">
              <MessageSquarePlus className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-sm font-semibold text-gray-300">No content requests found</p>
              <p className="text-xs text-gray-500">
                {requestStatusFilter !== 'all'
                  ? `There are currently no ${requestStatusFilter} requests.`
                  : 'Users have not submitted any movie or series requests yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requestsData.requests.map((req) => (
                <div
                  key={req._id}
                  className="p-4 bg-dark-surface border border-dark-border rounded-xl space-y-3 flex flex-col justify-between hover:border-dark-border/80 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              req.type === 'series'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {req.type === 'series' ? 'TV Series' : 'Movie'}
                          </span>
                          {req.releaseYear && (
                            <span className="text-xs text-gray-400 font-semibold">({req.releaseYear})</span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-base mt-1">{req.title}</h4>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                          req.status === 'fulfilled'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {req.status === 'fulfilled' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'rejected' && <Ban className="w-3 h-3" />}
                        {req.status === 'pending' && <Clock className="w-3 h-3" />}
                        <span>{req.status}</span>
                      </span>
                    </div>

                    {req.notes && (
                      <p className="text-xs text-gray-300 bg-dark-card/60 p-2.5 rounded-lg border border-dark-border/40 italic">
                        "{req.notes}"
                      </p>
                    )}

                    <div className="text-[11px] text-gray-400 space-y-0.5 pt-1">
                      <div>
                        <span className="text-gray-500">Requested by: </span>
                        <span className="text-gray-300 font-medium">{req.userName || 'Guest User'}</span>
                        {req.userEmail && <span className="text-gray-500"> ({req.userEmail})</span>}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(req.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Request Actions */}
                  <div className="pt-2 border-t border-dark-border/60 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAddFromRequest(req)}
                      className="px-2.5 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-lg border border-brand-500/30 flex items-center space-x-1 transition-all"
                      title="Pre-fill movie/series form with this title"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Catalog</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      {req.status !== 'fulfilled' && (
                        <button
                          type="button"
                          onClick={() => updateRequestMutation.mutate({ id: req._id, status: 'fulfilled' })}
                          className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/30 flex items-center space-x-1 transition-all"
                          title="Mark request fulfilled"
                        >
                          <Check className="w-3 h-3" />
                          <span>Fulfill</span>
                        </button>
                      )}

                      {req.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => updateRequestMutation.mutate({ id: req._id, status: 'rejected' })}
                          className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[11px] font-bold rounded-lg border border-rose-500/30 flex items-center space-x-1 transition-all"
                          title="Reject request"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      )}

                      {req.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => updateRequestMutation.mutate({ id: req._id, status: 'pending' })}
                          className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[11px] font-bold rounded-lg border border-amber-500/30 flex items-center space-x-1 transition-all"
                          title="Mark as pending"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete request for "${req.title}"?`)) {
                            deleteRequestMutation.mutate(req._id);
                          }
                        }}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manage Catalog Tab */}
      {activeTab === 'manage' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-5 animate-fade-in">
          {/* Header & Catalog Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-border pb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Manage Complete Catalog</h3>
              <p className="text-xs text-gray-400 mt-1">
                Showing all movies and series in the system ({catalog?.total || 0} total titles, including drafts and imports)
              </p>
            </div>

            {/* Type Filters */}
            <div className="flex items-center space-x-2">
              <div className="flex bg-dark-surface border border-dark-border rounded-xl p-0.5">
                {[
                  { id: 'all', label: 'All Types' },
                  { id: 'movie', label: 'Movies' },
                  { id: 'series', label: 'Series' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => {
                      setCatalogTypeFilter(tf.id as any);
                      setCatalogPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      catalogTypeFilter === tf.id
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={catalogStatusFilter}
                onChange={(e) => {
                  setCatalogStatusFilter(e.target.value as any);
                  setCatalogPage(1);
                }}
                className="bg-dark-surface border border-dark-border rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts Only</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search catalog by title, keyword..."
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value);
                  setCatalogPage(1);
                }}
                className="w-full bg-dark-surface border border-dark-border rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSearch('');
                    setCatalogPage(1);
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Catalog Content List */}
          {isCatalogLoading ? (
            <div className="text-center py-12 text-gray-400 text-xs">Loading catalog items...</div>
          ) : !catalog?.items || catalog.items.length === 0 ? (
            <div className="text-center py-12 bg-dark-surface/50 border border-dark-border/50 rounded-2xl space-y-2">
              <Film className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-sm font-semibold text-gray-300">No content found</p>
              <p className="text-xs text-gray-500">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {catalog.items.map((item) => (
                <div key={item._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-dark-surface/30 px-2 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={item.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200'}
                      alt={item.title}
                      className="w-11 h-16 object-cover rounded-lg flex-shrink-0 border border-dark-border bg-dark-surface"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-white text-sm truncate">{item.title}</h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            item.type === 'series'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {item.type}
                        </span>
                        {item.status === 'draft' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Draft
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Published
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.releaseYear || 'N/A'} • Rating: {item.rating || 'N/A'} • {item.genres?.slice(0, 2).join(', ') || 'General'}
                      </p>
                      {item.languages && item.languages.length > 0 && (
                        <p className="text-[11px] text-gray-500">
                          Languages: {item.languages.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <Link
                      to={`/watch/${item._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-white hover:bg-dark-surface rounded-lg transition-colors flex items-center space-x-1"
                      title="View Live Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-xs font-semibold hidden md:inline">View</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleEditOpen(item)}
                      className="p-2 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors flex items-center space-x-1"
                      title="Edit Name & Details"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${item.title}?`)) {
                          deleteMutation.mutate(item._id);
                        }
                      }}
                      className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {catalog && catalog.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-dark-border pt-4">
              <span className="text-xs text-gray-400">
                Page {catalog.page} of {catalog.totalPages} ({catalog.total} total items)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={catalog.page <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  disabled={catalog.page >= catalog.totalPages}
                  onClick={() => setCatalogPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded-xl text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Content Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-dark-card border border-dark-border rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 border-b border-dark-border pb-3">
              <Edit2 className="w-5 h-5 text-brand-500" />
              <h3 className="font-bold text-lg text-white">Edit {editingItem.type === 'series' ? 'Series' : 'Movie'} Details</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Title / Name (Visible to All Users)
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Content Type</label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditType('movie')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center space-x-1.5 ${
                      editType === 'movie'
                        ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                        : 'bg-dark-surface border-dark-border text-gray-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Movie</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('series')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center space-x-1.5 ${
                      editType === 'series'
                        ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                        : 'bg-dark-surface border-dark-border text-gray-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>TV Series</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Release Year</label>
                  <input
                    type="number"
                    value={editReleaseYear}
                    onChange={(e) => setEditReleaseYear(Number(e.target.value))}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={editRating}
                    onChange={(e) => setEditRating(Number(e.target.value))}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Poster Image URL</label>
                <input
                  type="text"
                  value={editPosterUrl}
                  onChange={(e) => setEditPosterUrl(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Backdrop Image URL</label>
                <input
                  type="text"
                  value={editBackdropUrl}
                  onChange={(e) => setEditBackdropUrl(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 bg-dark-surface hover:bg-dark-hover text-gray-300 font-semibold text-xs rounded-xl border border-dark-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow shadow-brand-500/25"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save & Publish Name Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
