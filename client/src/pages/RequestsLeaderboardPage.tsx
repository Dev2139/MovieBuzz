import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Flame,
  Trophy,
  ThumbsUp,
  Search,
  Plus,
  Film,
  Tv,
  Loader2,
  X,
  Sparkles,
  Bell,
} from 'lucide-react';
import {
  fetchRequestsLeaderboardApi,
  voteRequestApi,
  submitContentRequestApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { LeaderboardRequestItem } from '../types';

type TypeFilter = 'all' | 'movie' | 'series';

export const RequestsLeaderboardPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Submit form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'movie' | 'series'>('movie');
  const [formYear, setFormYear] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['requests-leaderboard', search, typeFilter],
    queryFn: () =>
      fetchRequestsLeaderboardApi({
        search: search.trim() || undefined,
        type: typeFilter,
      }),
    staleTime: 15 * 1000,
  });

  const requests = data?.requests || [];

  const voteMutation = useMutation({
    mutationFn: voteRequestApi,
    onSuccess: (res) => {
      showToast(res.message || 'Done!', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests-leaderboard'] });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Failed to vote', 'error');
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitContentRequestApi,
    onSuccess: (res) => {
      showToast(res.message || 'Request submitted!', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests-leaderboard'] });
      setIsFormOpen(false);
      setFormTitle('');
      setFormYear('');
      setFormNotes('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to submit request';
      showToast(msg, 'error');
    },
  });

  const handleVote = (item: LeaderboardRequestItem) => {
    if (!user) {
      openAuthModal();
      return;
    }
    voteMutation.mutate(item._id);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    submitMutation.mutate({
      title: formTitle.trim(),
      type: formType,
      releaseYear: formYear ? Number(formYear) : undefined,
      notes: formNotes.trim() || undefined,
    });
  };

  const rankStyle = (idx: number): string => {
    if (idx === 0) return 'from-yellow-400 to-amber-600 text-black';
    if (idx === 1) return 'from-gray-200 to-gray-400 text-black';
    if (idx === 2) return 'from-amber-600 to-amber-800 text-white';
    return 'from-dark-border to-dark-surface text-gray-300';
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 bg-dark-base">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950/60 via-dark-card to-dark-surface p-6 sm:p-8 mb-6">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-brand-300 text-xs font-bold uppercase tracking-widest">
                  Community Requests
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2">
                Most Wanted Titles
              </h1>
              <p className="text-gray-300 text-sm sm:text-base max-w-xl">
                Vote for the movies & series you want us to add. The higher a title ranks,
                the faster we bring it. Get notified the moment your request goes live.
              </p>
            </div>
            <button
              onClick={() => (user ? setIsFormOpen(true) : openAuthModal())}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 transition transform hover:scale-105 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Request a title
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search requested titles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          </div>
          <div className="flex gap-2">
            {(['all', 'movie', 'series'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition ${
                  typeFilter === t
                    ? 'bg-brand-500 text-white'
                    : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading leaderboard…
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-dark-card border border-dark-border rounded-2xl">
            <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-3" />
            <p className="text-gray-300 font-bold mb-1">No requests yet</p>
            <p className="text-gray-500 text-sm mb-4">Be the first to ask for a title!</p>
            <button
              onClick={() => (user ? setIsFormOpen(true) : openAuthModal())}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition"
            >
              <Plus className="w-4 h-4" /> Request a title
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((item, idx) => (
              <div
                key={item._id}
                className={`flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition ${
                  item.hasVoted
                    ? 'bg-brand-500/10 border-brand-500/40'
                    : 'bg-dark-card border-dark-border hover:border-brand-500/30'
                }`}
              >
                {/* Rank */}
                <div
                  className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${rankStyle(
                    idx
                  )} flex items-center justify-center font-black text-lg shadow-lg`}
                >
                  {idx < 3 ? (
                    <Trophy className="w-5 h-5" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-bold truncate">{item.title}</h3>
                    {item.isMine && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold uppercase">
                        Yours
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      {item.type === 'series' ? (
                        <Tv className="w-3 h-3" />
                      ) : (
                        <Film className="w-3 h-3" />
                      )}
                      {item.type}
                    </span>
                    {item.releaseYear && <span>· {item.releaseYear}</span>}
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-brand-300 font-semibold">
                      <Flame className="w-3 h-3" />
                      {item.voteCount} {item.voteCount === 1 ? 'want' : 'wants'}
                    </span>
                  </div>
                </div>

                {/* Vote button */}
                <button
                  onClick={() => handleVote(item)}
                  disabled={voteMutation.isPending}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-60 ${
                    item.hasVoted
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                      : 'bg-dark-border hover:bg-brand-500/30 text-gray-200 border border-dark-border'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${item.hasVoted ? 'fill-current' : ''}`} />
                  <span className="hidden sm:inline">
                    {item.hasVoted ? 'Voted' : 'Me too'}
                  </span>
                  <span className="sm:hidden">{item.voteCount}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notification hint */}
        <div className="mt-8 flex items-start gap-3 p-4 rounded-2xl bg-dark-card border border-dark-border">
          <Bell className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <b className="text-white">Stay in the loop.</b> Signed-in users get an in-app
            notification the moment someone else backs their request — and when the title is
            finally added to CineStream. 🎉
          </div>
        </div>
      </div>

      {/* Submit Request Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full p-6 relative animate-fade-in-scale">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-1">Request a title</h3>
            <p className="text-gray-400 text-xs mb-5">
              If someone already requested it, your vote is added to the leaderboard automatically.
            </p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Interstellar"
                  className="w-full bg-dark-base border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">Type</label>
                  <div className="flex gap-2">
                    {(['movie', 'series'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition ${
                          formType === t
                            ? 'bg-brand-500 text-white'
                            : 'bg-dark-base border border-dark-border text-gray-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">Year</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    placeholder="2024"
                    className="w-full bg-dark-base border border-dark-border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Language, quality, any details…"
                  rows={2}
                  className="w-full bg-dark-base border border-dark-border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitMutation.isPending || !formTitle.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition disabled:opacity-60"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Submit request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsLeaderboardPage;
