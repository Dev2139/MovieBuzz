import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchAdminStats,
  createMovieApi,
  createSeriesApi,
  fetchContentList,
  deleteContentApi,
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
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'add-movie' | 'add-series' | 'manage'>('overview');

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
  });

  // Manage content catalog query
  const { data: catalog } = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: () => fetchContentList({ limit: 50 }),
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
      <div className="flex space-x-2 border-b border-dark-border pb-3">
        {[
          { id: 'overview', label: 'Dashboard Overview' },
          { id: 'add-movie', label: 'Add New Movie' },
          { id: 'add-series', label: 'Add New Series' },
          { id: 'manage', label: 'Manage Catalog' },
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* Manage Catalog Tab */}
      {activeTab === 'manage' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 animate-fade-in">
          <h3 className="text-xl font-bold text-white">Platform Content Items</h3>
          <div className="divide-y divide-dark-border">
            {catalog?.items && catalog.items.map((item) => (
              <div key={item._id} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img src={item.posterUrl} alt={item.title} className="w-10 h-14 object-cover rounded-lg" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-400 uppercase">{item.type} • {item.releaseYear}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${item.title}?`)) {
                      deleteMutation.mutate(item._id);
                    }
                  }}
                  className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Delete Item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
