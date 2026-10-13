import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  Wallet,
  Crown,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  TrendingUp,
  Gift,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Rocket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchSubscriptionPlans } from '../services/api';

export const PremiumPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans,
    staleTime: 10 * 60 * 1000,
  });
  const plans = plansData?.plans || [];

  const balance = user?.cineCoins ?? 0;
  const expiryMs = user?.coinsExpiryAt ? new Date(user.coinsExpiryAt).getTime() - Date.now() : 0;
  const hrsLeft = Math.max(0, Math.floor(expiryMs / 3600000));
  const minsLeft = Math.max(0, Math.floor((expiryMs % 3600000) / 60000));
  const pctLeft = Math.max(0, Math.min(100, (expiryMs / (5 * 3600000)) * 100));

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 bg-dark-base">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/40 bg-gradient-to-br from-brand-950 via-dark-card to-dark-surface p-6 sm:p-12">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-8 left-8 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/40">
              <Sparkles className="w-3.5 h-3.5 text-brand-300" />
              <span className="text-brand-200 text-[11px] sm:text-xs font-black uppercase tracking-widest">
                Premium Features · Loyalty Program
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight leading-[1.1]">
              Watch Movies.
              <br />
              Earn <span className="text-brand-400">CineCoins</span>.
              <br />
              Get <span className="bg-gradient-to-r from-yellow-400 via-brand-400 to-purple-400 bg-clip-text text-transparent">Real Money</span>.
            </h1>

            <p className="text-gray-300 text-sm sm:text-lg max-w-2xl mb-6 leading-relaxed">
              Every 30 minutes you actively watch a movie or series, we credit{' '}
              <b className="text-brand-300">2 CineCoins</b> to your account. 1 CineCoin ={' '}
              <b className="text-brand-300">₹1 real money</b>. Buy any subscription plan and cash out
              directly to your UPI wallet.
            </p>

            {/* Rate + rules badges */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/40 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-bold">30 min = 2 coins</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/40 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-white font-bold">1 coin = ₹1</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/40 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span className="text-white font-bold">Pause / hide tab = no coins</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-brand-500/40 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-brand-400" />
                <span className="text-white font-bold">Our buffering still counts</span>
              </div>
              <div className="flex items-center gap-2 bg-dark-base/70 border border-red-500/40 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-white font-bold">Coins expire in 5 hours</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/40 transition transform hover:scale-105"
                >
                  <Wallet className="w-4 h-4" />
                  Go to my Profile ({balance} coins = ₹{balance})
                </Link>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/40 transition transform hover:scale-105"
                >
                  <Coins className="w-4 h-4" />
                  Sign in to start earning
                </button>
              )}
              <a
                href="#plans"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-dark-border/60 hover:bg-dark-border border border-dark-border text-white font-semibold transition"
              >
                <Crown className="w-4 h-4 text-yellow-400" />
                View subscription plans
              </a>
            </div>

            {/* Live balance card for signed-in users */}
            {user && balance > 0 && (
              <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-dark-base/80 border border-brand-500/30 max-w-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-widest font-bold text-brand-300">
                    Your live balance
                  </div>
                  <div className="text-2xl font-black text-white">
                    {balance} <span className="text-brand-300 text-sm">coins</span>
                  </div>
                </div>
                {expiryMs > 0 ? (
                  <>
                    <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mb-1.5 font-semibold">
                      <span>⏳ Expires in {hrsLeft}h {minsLeft}m</span>
                      <span>5h window</span>
                    </div>
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
                        style={{ width: `${pctLeft}%` }}
                      />
                    </div>
                    <div className="text-[10px] sm:text-xs text-red-300 mt-2">
                      Redeem before the timer runs out or your coins will be lost.
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-1">
                    Keep watching to earn more.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <h2 className="text-2xl sm:text-3xl font-black text-white">How it works</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: 1, icon: <CheckCircle2 className="w-5 h-5" />, title: 'Sign in', body: 'Create a free account so we can store the CineCoins you earn. Guests can browse but cannot earn.' },
            { n: 2, icon: <Zap className="w-5 h-5" />, title: 'Watch actively', body: 'Press play on any movie or episode. Keep the tab visible. Every 30 min of active watching = +2 coins.' },
            { n: 3, icon: <Crown className="w-5 h-5" />, title: 'Buy a plan', body: 'Subscription unlocks redemption. Your coins stay safe even if the plan expires.' },
            { n: 4, icon: <Smartphone className="w-5 h-5" />, title: 'Cash out to UPI', body: 'Enter your UPI ID, we process the payout and track it in your dashboard.' },
          ].map((s) => (
            <div key={s.n} className="relative bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-brand-500/50 transition">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center font-black">
                  {s.n}
                </div>
                <div className="text-brand-400">{s.icon}</div>
              </div>
              <div className="text-white font-bold mb-1">{s.title}</div>
              <p className="text-gray-400 text-xs leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earning Rules */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
          <h2 className="text-2xl sm:text-3xl font-black text-white">Earning rules — what counts and what doesn't</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-500/10 to-dark-card border border-green-500/30 rounded-2xl p-5">
            <div className="text-green-400 font-black text-sm uppercase tracking-wider mb-3">✓ Counts as watch time</div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> Video is actively playing</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> Browser tab is visible & focused</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> Our server is buffering / loading chunks</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> Full-screen playback on mobile & desktop</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-red-500/10 to-dark-card border border-red-500/30 rounded-2xl p-5">
            <div className="text-red-400 font-black text-sm uppercase tracking-wider mb-3">✗ Does NOT count</div>
            <ul className="space-y-2 text-sm text-gray-200">
              <li className="flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Video is paused or ended</li>
              <li className="flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Tab is hidden / backgrounded</li>
              <li className="flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Watching a pre-roll advertisement</li>
              <li className="flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Guests, admins, and legacy premium accounts</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-red-300 font-bold text-sm mb-1">5-hour expiry policy</div>
            <div className="text-gray-200 text-xs sm:text-sm leading-relaxed">
              Once you earn your first unspent coin, a <b>5-hour countdown</b> starts. If you don't redeem
              your balance within that window, all pending coins expire and are removed from your account.
              The next coin you earn starts a fresh 5-hour window. Buy a subscription plan to unlock redemption.
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section id="plans" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-24">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h2 className="text-2xl sm:text-3xl font-black text-white">Subscription plans</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6 max-w-2xl">
          Buying any plan unlocks the ability to redeem your CineCoins to real money via UPI.
          Premium plan also earns you <b className="text-brand-300">1.5× coins</b> on every 30 min of watching.
        </p>

        {plans.length === 0 ? (
          <div className="text-gray-400 text-sm">Loading plans…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isPremiumPlan = p.id === 'premium';
              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl p-5 sm:p-6 border-2 transition ${
                    isPremiumPlan
                      ? 'bg-gradient-to-br from-brand-900 via-dark-card to-dark-surface border-brand-500 shadow-2xl shadow-brand-500/20'
                      : 'bg-dark-card border-dark-border hover:border-brand-500/50'
                  }`}
                >
                  {isPremiumPlan && (
                    <div className="absolute -top-3 left-6 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                      <Rocket className="w-3 h-3" /> Best Value · 1.5× Coins
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-brand-400" />
                    <div className="text-white font-black text-lg capitalize">{p.id}</div>
                  </div>
                  <div className="text-3xl font-black text-white mb-1">
                    ₹{p.priceINR}
                    <span className="text-sm text-gray-400 font-semibold ml-1">/ {p.durationDays}d</span>
                  </div>
                  <div className="text-gray-400 text-xs mb-4">
                    {p.durationDays >= 365 ? 'Full year access' : p.durationDays >= 90 ? 'Quarterly plan' : 'Monthly plan'}
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-300 mb-5">
                    <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> Unlocks coin redemption</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> Ad-free streaming</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> Priority buffering</li>
                    {isPremiumPlan && (
                      <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" /> <b className="text-brand-300">1.5× coin multiplier</b> on every earn</li>
                    )}
                  </ul>
                  {user ? (
                    <Link
                      to="/profile"
                      className={`block text-center w-full py-2.5 rounded-xl font-bold text-sm transition ${
                        isPremiumPlan
                          ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30'
                          : 'bg-dark-border hover:bg-brand-500/20 hover:text-brand-300 text-white'
                      }`}
                    >
                      {user.subscriptionPlan === p.id ? 'Manage in Profile' : `Get ${p.id}`}
                    </Link>
                  ) : (
                    <button
                      onClick={openAuthModal}
                      className="w-full py-2.5 rounded-xl bg-dark-border hover:bg-brand-500 hover:text-white text-white font-bold text-sm transition"
                    >
                      Sign in to purchase
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <h2 className="text-2xl sm:text-3xl font-black text-white">FAQ</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Do I need to pay to earn coins?', a: 'No. Any signed-in free user earns 2 CineCoins for every 30 minutes of active watching. You only need a subscription to REDEEM them for real money.' },
            { q: 'What if I pause the video?', a: 'The 30-minute counter freezes while paused. Resume watching and the counter picks up where it left off. If you leave the tab hidden for a long time, that period is not counted.' },
            { q: 'Why do coins expire after 5 hours?', a: 'It keeps the loyalty pool healthy and encourages you to redeem promptly. Buy any subscription plan (₹49+) and cash out within 5 hours of your last earn. Fresh coins start a fresh 5-hour window.' },
            { q: 'Can admins or premium staff earn coins?', a: 'No. Admin and legacy premium accounts are exempt from the loyalty program by design.' },
            { q: 'How fast are UPI payouts?', a: 'Redemptions are reviewed by our team and typically paid out within 24–48 hours to the UPI ID you provided. Track status in your Profile → Redemption History.' },
            { q: 'What happens if my subscription expires?', a: 'Your coins stay in your account. You just cannot redeem until you renew. Earning continues as long as you keep watching.' },
          ].map((f, i) => (
            <details key={i} className="group bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
              <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-dark-hover transition">
                <span className="text-white font-bold text-sm sm:text-base">{f.q}</span>
                <span className="shrink-0 w-6 h-6 rounded-full bg-dark-border group-open:bg-brand-500 flex items-center justify-center text-white text-xs font-black transition">+</span>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-gray-300 text-xs sm:text-sm leading-relaxed border-t border-dark-border pt-3">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/40 bg-gradient-to-br from-brand-950 via-dark-card to-dark-surface p-6 sm:p-10 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.15),transparent_70%)]" />
          <div className="relative z-10">
            <Coins className="w-10 h-10 text-brand-400 mx-auto mb-3" />
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Ready to turn watch time into wallet balance?
            </h3>
            <p className="text-gray-300 text-sm sm:text-base mb-6 max-w-xl mx-auto">
              {user
                ? `You have ${balance} CineCoins (${balance > 0 ? `₹${balance}` : 'start watching to earn'}) right now. Jump into your profile to redeem.`
                : 'Sign in free and start earning on your very next movie.'}
            </p>
            {user ? (
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-black shadow-lg shadow-brand-500/40 transition transform hover:scale-105"
              >
                <Wallet className="w-5 h-5" />
                Open my Profile
              </Link>
            ) : (
              <button
                onClick={openAuthModal}
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-black shadow-lg shadow-brand-500/40 transition transform hover:scale-105"
              >
                <Coins className="w-5 h-5" />
                Sign in / Create account
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PremiumPage;
