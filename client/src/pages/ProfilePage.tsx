import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coins,
  Crown,
  Wallet,
  LogOut,
  History,
  Bookmark,
  ShieldCheck,
  X,
  CheckCircle2,
  Clock,
  Ban,
  Sparkles,
  Loader2,
  Smartphone,
  Film,
} from 'lucide-react';
import {
  fetchUserCoinsApi,
  fetchSubscriptionPlans,
  purchaseSubscriptionApi,
  redeemCoinsApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const ProfilePage: React.FC = () => {
  const { user, logout, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [upiInput, setUpiInput] = useState<string>('');

  const coinsQuery = useQuery({
    queryKey: ['user-coins', user?.id],
    queryFn: fetchUserCoinsApi,
    enabled: !!user,
    refetchInterval: 15000,
  });

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans,
  });

  const purchaseMutation = useMutation({
    mutationFn: (planId: string) => purchaseSubscriptionApi(planId),
    onSuccess: (data) => {
      showToast(data.message || 'Subscription activated!', 'success');
      queryClient.invalidateQueries({ queryKey: ['user-coins'] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Failed to activate subscription', 'error');
    },
  });

  const redeemMutation = useMutation({
    mutationFn: ({ coins, upiId }: { coins: number; upiId: string }) =>
      redeemCoinsApi(coins, upiId),
    onSuccess: (data) => {
      showToast(data.message || 'Redemption submitted', 'success');
      setIsRedeemOpen(false);
      setRedeemAmount(0);
      queryClient.invalidateQueries({ queryKey: ['user-coins'] });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Redemption failed', 'error');
    },
  });

  // ---------- Loading / Guest states ----------
  if (isAuthLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-8 max-w-md">
          <Coins className="w-12 h-12 text-brand-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Sign in to earn CineCoins</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Watch movies and series on CineStream, earn 2 CineCoins for every 30 minutes
            of active viewing, and redeem them for real money in your UPI wallet.
          </p>
          <button
            onClick={openAuthModal}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl transition"
          >
            Sign in / Register
          </button>
        </div>
      </div>
    );
  }

  const coins = coinsQuery.data;
  const cineCoins = coins?.cineCoins ?? user.cineCoins ?? 0;
  const totalEarned = coins?.totalCoinsEarned ?? user.totalCoinsEarned ?? 0;
  const subActive = coins?.subscriptionActive ?? user.subscriptionActive ?? false;
  const pendingSeconds = coins?.watchTimeCounter ?? user.watchTimeCounter ?? 0;
  const minutesToNext = Math.max(0, Math.ceil((1800 - pendingSeconds) / 60));

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const openRedeem = () => {
    if (!subActive) {
      showToast('Buy a subscription plan to unlock redemption', 'info');
      return;
    }
    if (cineCoins <= 0) {
      showToast('You have no coins to redeem yet', 'info');
      return;
    }
    setRedeemAmount(Math.min(cineCoins, 100));
    setUpiInput(user.upiId || '');
    setIsRedeemOpen(true);
  };

  // ---------- Main Render ----------
  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white truncate">{user.name}</h1>
            <p className="text-gray-400 text-sm truncate">{user.email}</p>
          </div>
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 transition text-sm"
            >
              <ShieldCheck className="w-4 h-4" /> Admin
            </Link>
          )}
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="p-2 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-red-400 hover:border-red-500/40 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Coin balance hero */}
        <div className="bg-gradient-to-br from-brand-900/40 via-dark-card to-dark-card border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-8 -top-8 opacity-20">
            <Coins className="w-40 h-40 text-brand-400" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 text-brand-300 text-sm font-semibold uppercase tracking-wider">
              <Coins className="w-4 h-4" /> CineCoins Balance
            </div>
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <div className="text-5xl font-black text-white">{cineCoins}</div>
              <div className="text-xl text-brand-300 font-bold">= {formatINR(cineCoins)}</div>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              You have earned <span className="text-brand-300 font-bold">{totalEarned}</span> total coins lifetime.
              {subActive ? (
                <> Redemption is <span className="text-green-400 font-bold">unlocked</span>.</>
              ) : (
                <> Buy a subscription to <span className="text-yellow-400 font-bold">unlock redemption</span>.</>
              )}
            </p>
            {cineCoins > 0 && !subActive && (
              <div className="mb-4 text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg px-3 py-2">
                Your coins are safely stored on your account. You can redeem them at any time
                once your subscription plan is active.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openRedeem}
                disabled={cineCoins <= 0 || !subActive}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
                  cineCoins > 0 && subActive
                    ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30'
                    : 'bg-dark-border text-gray-500 cursor-not-allowed'
                }`}
              >
                <Wallet className="w-4 h-4" /> Redeem to UPI
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-base/60 border border-dark-border text-sm text-gray-300">
                <Film className="w-4 h-4 text-brand-400" />
                {minutesToNext} min to next coin
              </div>
            </div>
          </div>
        </div>

        {/* Subscription status + plans */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="md:col-span-1 bg-dark-card border border-dark-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-brand-300 font-bold text-sm uppercase tracking-wider mb-3">
              <Crown className="w-4 h-4" /> Subscription
            </div>
            {subActive ? (
              <>
                <div className="text-2xl font-bold text-white capitalize mb-1">
                  {coins?.subscriptionPlan || user.subscriptionPlan} Plan
                </div>
                <div className="text-gray-400 text-sm mb-3">
                  Active until{' '}
                  <span className="text-white">
                    {new Date(
                      coins?.subscriptionExpiresAt || user.subscriptionExpiresAt || Date.now()
                    ).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Redemption unlocked
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-white mb-1">No active plan</div>
                <p className="text-gray-400 text-sm">
                  Buy any plan below to unlock instant UPI redemption of your CineCoins.
                </p>
              </>
            )}
          </div>

          <div className="md:col-span-2 space-y-3">
            {(plansQuery.data?.plans || []).map((plan) => {
              const isCurrent = user.subscriptionPlan === plan.id && subActive;
              return (
                <div
                  key={plan.id}
                  className={`bg-dark-card border rounded-xl p-4 flex items-center justify-between gap-3 transition ${
                    isCurrent
                      ? 'border-brand-500/60 shadow-brand-500/10 shadow-md'
                      : 'border-dark-border'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold">{plan.name}</span>
                      <span className="text-xs text-gray-500">
                        {plan.durationDays} days
                      </span>
                      {plan.id === 'premium' && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> 1.5× coins
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 line-clamp-2">
                      {plan.perks.join(' • ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-white font-bold">{formatINR(plan.priceINR)}</div>
                      <div className="text-xs text-gray-500">one-time</div>
                    </div>
                    <button
                      disabled={purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate(plan.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        isCurrent
                          ? 'bg-brand-500/20 border border-brand-500/40 text-brand-300'
                          : 'bg-brand-500 hover:bg-brand-600 text-white'
                      } disabled:opacity-60`}
                    >
                      {purchaseMutation.isPending && purchaseMutation.variables === plan.id
                        ? 'Processing…'
                        : isCurrent
                          ? 'Extend'
                          : 'Buy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Link
            to="/watchlist"
            className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3 hover:border-brand-500/50 transition"
          >
            <Bookmark className="w-5 h-5 text-brand-400" />
            <span className="text-white text-sm font-semibold">Watchlist</span>
          </Link>
          <Link
            to="/history"
            className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3 hover:border-brand-500/50 transition"
          >
            <History className="w-5 h-5 text-brand-400" />
            <span className="text-white text-sm font-semibold">History</span>
          </Link>
          <Link
            to="/search"
            className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3 hover:border-brand-500/50 transition"
          >
            <Smartphone className="w-5 h-5 text-brand-400" />
            <span className="text-white text-sm font-semibold">Discover</span>
          </Link>
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="bg-dark-card border border-purple-500/40 rounded-xl p-4 flex items-center gap-3 hover:border-purple-500/60 transition md:hidden"
            >
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <span className="text-white text-sm font-semibold">Admin</span>
            </Link>
          )}
        </div>

        {/* Redemption history */}
        <div className="mb-8">
          <h2 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-400" /> Redemption History
          </h2>
          {coinsQuery.isLoading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : (coins?.redemptions || []).length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center text-gray-400 text-sm">
              No redemptions yet. Earn coins by watching, then redeem them to your UPI.
            </div>
          ) : (
            <div className="space-y-2">
              {(coins?.redemptions || []).map((r) => (
                <div
                  key={r._id}
                  className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-white font-bold">
                      {r.coins} coins → {formatINR(r.amountINR)}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{r.upiId}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.adminNote && <div className="italic text-gray-400 mt-1">"{r.adminNote}"</div>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {r.status === 'pending' && (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    {r.status === 'approved' && (
                      <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    )}
                    {r.status === 'rejected' && (
                      <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                        <Ban className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div>
          <h2 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" /> Coin Activity
          </h2>
          {coinsQuery.isLoading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : (coins?.transactions || []).length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center text-gray-400 text-sm">
              No activity yet. Start watching to earn coins!
            </div>
          ) : (
            <div className="space-y-2">
              {(coins?.transactions || []).map((t) => (
                <div
                  key={t._id}
                  className="bg-dark-card border border-dark-border rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium">
                      {t.type === 'earned' && '+ earned from watching'}
                      {t.type === 'redeemed' && '− redeemed to UPI'}
                      {t.type === 'refund' && '+ refund (rejected redemption)'}
                      {t.type === 'admin-adjust' && 'admin adjustment'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {t.note || ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(t.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-bold ${
                        t.amount >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {t.amount >= 0 ? '+' : ''}
                      {t.amount}
                    </div>
                    <div className="text-xs text-gray-500">bal {t.balanceAfter}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Redeem Modal */}
      {isRedeemOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsRedeemOpen(false)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Redeem CineCoins</h3>
              <button
                onClick={() => setIsRedeemOpen(false)}
                className="p-1 rounded hover:bg-dark-border text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 text-sm bg-brand-500/10 border border-brand-500/30 text-brand-200 rounded-lg p-3">
              You have <span className="font-bold">{cineCoins} coins</span> available
              ({formatINR(cineCoins)}).
            </div>

            <label className="block text-sm text-gray-400 mb-1">Coins to redeem</label>
            <input
              type="number"
              min={1}
              max={cineCoins}
              value={redeemAmount}
              onChange={(e) =>
                setRedeemAmount(Math.max(1, Math.min(cineCoins, Number(e.target.value) || 0)))
              }
              className="w-full px-3 py-2 rounded-lg bg-dark-base border border-dark-border text-white mb-3"
            />

            <label className="block text-sm text-gray-400 mb-1">Your UPI ID</label>
            <input
              type="text"
              placeholder="yourname@bank"
              value={upiInput}
              onChange={(e) => setUpiInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-base border border-dark-border text-white mb-1"
            />
            <p className="text-xs text-gray-500 mb-4">
              Example: <span className="font-mono">9876543210@ybl</span> or{' '}
              <span className="font-mono">name@okhdfcbank</span>
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setIsRedeemOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-dark-border text-gray-300 hover:bg-dark-border/70 transition font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={
                  redeemMutation.isPending ||
                  redeemAmount <= 0 ||
                  redeemAmount > cineCoins ||
                  !/^[\w.\-]{2,}@[a-zA-Z]{2,}/.test(upiInput.trim())
                }
                onClick={() =>
                  redeemMutation.mutate({ coins: redeemAmount, upiId: upiInput.trim() })
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redeemMutation.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
