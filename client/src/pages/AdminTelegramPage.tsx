import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTelegramImports,
  syncTelegramChannelApi,
  parseTelegramPostApi,
  publishTelegramImportApi,
} from '../services/api';
import { TelegramImportItem } from '../types';
import { Send, RefreshCw, CheckCircle, Eye, Shield, Edit3, X, Sparkles, Filter } from 'lucide-react';

export const AdminTelegramPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('PENDING');
  const [selectedImportDoc, setSelectedImportDoc] = useState<TelegramImportItem | null>(null);

  // Form edit state for selected post mapping
  const [editTitle, setEditTitle] = useState('');
  const [targetType, setTargetType] = useState<'movie' | 'series'>('movie');
  const [editSeasonNum, setEditSeasonNum] = useState<number>(1);
  const [editEpNum, setEditEpNum] = useState<number>(1);
  const [editQuality, setEditQuality] = useState('1080p');
  const [editPosterUrl, setEditPosterUrl] = useState('');

  // Caption tester
  const [testCaption, setTestCaption] = useState('Cyberpunk: Neon City (2026) 1080p Dual Audio English Sci-Fi WEBRip');
  const [parsedTestResult, setParsedTestResult] = useState<any | null>(null);

  // Fetch Import Queue Query
  const { data: importsData, isLoading } = useQuery({
    queryKey: ['telegram-imports', selectedStatusFilter],
    queryFn: () => fetchTelegramImports(selectedStatusFilter),
  });

  // Channel Sync Mutation
  const syncMutation = useMutation({
    mutationFn: syncTelegramChannelApi,
    onSuccess: (data) => {
      alert(`Channel sync finished. ${data.newPostsCount} posts added to pending review queue.`);
      queryClient.invalidateQueries({ queryKey: ['telegram-imports'] });
    },
  });

  // Caption Tester Mutation
  const parseTestMutation = useMutation({
    mutationFn: parseTelegramPostApi,
    onSuccess: (data) => {
      setParsedTestResult(data.parsed);
    },
  });

  // Publish / Map Mutation
  const publishMutation = useMutation({
    mutationFn: publishTelegramImportApi,
    onSuccess: (data) => {
      alert(`Success: ${data.message}`);
      setSelectedImportDoc(null);
      queryClient.invalidateQueries({ queryKey: ['telegram-imports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const handleSelectDoc = (doc: TelegramImportItem) => {
    setSelectedImportDoc(doc);
    setEditTitle(doc.detectedTitle || '');
    setTargetType(doc.detectedSeason ? 'series' : 'movie');
    setEditSeasonNum(doc.detectedSeason || 1);
    setEditEpNum(doc.detectedEpisode || 1);
    setEditQuality(doc.detectedQuality || '1080p');
    setEditPosterUrl('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800');
  };

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImportDoc) return;

    publishMutation.mutate({
      importId: selectedImportDoc._id,
      action: 'PUBLISH',
      targetType,
      title: editTitle,
      seasonNumber: editSeasonNum,
      episodeNumber: editEpNum,
      quality: editQuality,
      posterUrl: editPosterUrl,
    });
  };

  const handleIgnore = () => {
    if (!selectedImportDoc) return;
    publishMutation.mutate({
      importId: selectedImportDoc._id,
      action: 'IGNORE',
    });
  };

  const importItems = importsData?.imports || [];

  return (
    <div className="min-h-screen bg-dark-base text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-border pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center text-blue-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Telegram Import Dashboard</h1>
            <p className="text-xs text-gray-400 mt-1">Review channel posts, correct metadata, map to media, and publish</p>
          </div>
        </div>

        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          <span>Sync Channel Posts Now</span>
        </button>
      </div>

      {/* Parser Tester Tool */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Regex Caption Parser Test Bench</span>
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={testCaption}
            onChange={(e) => setTestCaption(e.target.value)}
            className="flex-1 bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => parseTestMutation.mutate(testCaption)}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
          >
            Parse Test
          </button>
        </div>

        {parsedTestResult && (
          <div className="p-3 bg-dark-surface rounded-xl border border-dark-border text-xs font-mono text-emerald-400 space-y-1">
            <p>Title: {parsedTestResult.title}</p>
            <p>Year: {parsedTestResult.year || 'N/A'}</p>
            <p>Season: {parsedTestResult.season || 'N/A'}, Episode: {parsedTestResult.episode || 'N/A'}</p>
            <p>Quality: {parsedTestResult.quality} ({parsedTestResult.resolution})</p>
            <p>Language: {parsedTestResult.language}</p>
          </div>
        )}
      </div>

      {/* Queue Filter Bar */}
      <div className="flex items-center justify-between border-b border-dark-border pb-3">
        <div className="flex space-x-2">
          {['PENDING', 'IMPORTED', 'IGNORED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedStatusFilter === status
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-hover'
              }`}
            >
              {status} Posts
            </button>
          ))}
        </div>
      </div>

      {/* Import Queue Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading Telegram import queue...</div>
      ) : importItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {importItems.map((doc) => (
            <div
              key={doc._id}
              className="bg-dark-card border border-dark-border hover:border-gray-500 rounded-2xl p-5 space-y-3 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                    Channel Post #{doc.messageId.slice(-6)}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                    {doc.status}
                  </span>
                </div>

                <h4 className="font-bold text-white text-sm line-clamp-1">{doc.detectedTitle}</h4>
                <p className="text-xs text-gray-400 bg-dark-surface p-2.5 rounded-xl border border-dark-border font-mono line-clamp-2">
                  {doc.originalCaption}
                </p>

                <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                  <span className="bg-dark-surface px-2 py-1 rounded border border-dark-border">
                    Quality: {doc.detectedQuality || '1080p'}
                  </span>
                  {doc.detectedSeason && (
                    <span className="bg-dark-surface px-2 py-1 rounded border border-dark-border">
                      Season {doc.detectedSeason} Ep {doc.detectedEpisode}
                    </span>
                  )}
                  {doc.detectedLanguage && (
                    <span className="bg-dark-surface px-2 py-1 rounded border border-dark-border">
                      {doc.detectedLanguage}
                    </span>
                  )}
                </div>
              </div>

              {doc.status === 'PENDING' && (
                <button
                  onClick={() => handleSelectDoc(doc)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Review & Map Post</span>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-gray-400 bg-dark-card border border-dark-border rounded-2xl">
          No {selectedStatusFilter} Telegram channel posts in queue.
        </div>
      )}

      {/* Review & Publishing Modal */}
      {selectedImportDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-dark-card border border-dark-border rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <button
              onClick={() => setSelectedImportDoc(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-xl text-white">Admin Post Mapping & Publishing Review</h3>
            <p className="text-xs text-gray-400">
              Original Channel Caption: <span className="text-gray-300 font-mono italic">{selectedImportDoc.originalCaption}</span>
            </p>

            <form onSubmit={handlePublishSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Target Media Type</label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('movie')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      targetType === 'movie' ? 'bg-blue-600 text-white border-blue-500' : 'bg-dark-surface border-dark-border text-gray-300'
                    }`}
                  >
                    Movie
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('series')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      targetType === 'series' ? 'bg-blue-600 text-white border-blue-500' : 'bg-dark-surface border-dark-border text-gray-300'
                    }`}
                  >
                    TV Series Episode
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {targetType === 'series' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Season Number</label>
                    <input
                      type="number"
                      value={editSeasonNum}
                      onChange={(e) => setEditSeasonNum(Number(e.target.value))}
                      className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Episode Number</label>
                    <input
                      type="number"
                      value={editEpNum}
                      onChange={(e) => setEditEpNum(Number(e.target.value))}
                      className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Stream Quality</label>
                  <select
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Poster Cover Image URL</label>
                  <input
                    type="text"
                    value={editPosterUrl}
                    onChange={(e) => setEditPosterUrl(e.target.value)}
                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={publishMutation.isPending}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors"
                >
                  Publish Post to Platform Catalog
                </button>
                <button
                  type="button"
                  onClick={handleIgnore}
                  className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-xl transition-colors"
                >
                  Ignore Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
