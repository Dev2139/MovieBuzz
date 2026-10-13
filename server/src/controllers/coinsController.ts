import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { User } from '../models/User';
import { CoinTransaction } from '../models/CoinTransaction';
import { Redemption } from '../models/Redemption';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';

/**
 * CineCoins loyalty system:
 *   - 1 CineCoin = ₹1 real money
 *   - Users earn 2 coins for every 1800 continuous seconds (30 min) of ACTIVE watching
 *   - Coin earning works for logged-in users. Users can watch freely but balance is stored on the account.
 *   - Redeeming requires an ACTIVE subscription plan. Balance stays in the account if subscription lapses
 *     (they can top-up the subscription later and redeem whenever it is active again).
 *   - Redemption requires a valid UPI ID; the request shows up in the admin dashboard.
 */

// Configurable constants (could move to env later)
export const COIN_EARN_SECONDS = 1800;   // 30 min of active watching
export const COIN_EARN_AMOUNT = 2;       // 2 coins per 30 min
export const COIN_VALUE_INR = 1;         // 1 coin = ₹1
export const COIN_TTL_MS = 5 * 60 * 60 * 1000; // Unredeemed coins expire 5 hours after earning

export interface SubscriptionPlanDef {
  id: string;
  name: string;
  priceINR: number;
  durationDays: number;
  perks: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    priceINR: 49,
    durationDays: 30,
    perks: ['Redeem CineCoins to UPI', 'Ad-free streaming', 'HD 1080p playback'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceINR: 99,
    durationDays: 90,
    perks: ['Everything in Basic', 'Priority chunk delivery', 'Downloads in MP4'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceINR: 299,
    durationDays: 365,
    perks: ['Everything in Pro', '4K streaming ready', 'Early access to new titles', '1.5× coins earning rate'],
  },
];

const isSubscriptionActive = (user: any): boolean => {
  if (!user?.subscriptionPlan || !user?.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
};

/**
 * Lazy subscription lifecycle: if a user's subscription has lapsed, demote them
 * from premium (isPremium = false) so they return to free-user state and can earn
 * coins again. Callers must re-save the user if this returns true.
 */
const syncSubscriptionState = async (user: any): Promise<boolean> => {
  if (!user) return false;
  const stillActive =
    user.subscriptionPlan &&
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now();
  let changed = false;
  if (!stillActive && user.subscriptionPlan) {
    // Lapsed → remove premium badge but keep plan history fields
    if (user.isPremium) {
      user.isPremium = false;
      changed = true;
    }
  }
  return changed ? user.save().then(() => true) : false;
};

const planMultiplier = (planId: string | null): number => {
  if (planId === 'premium') return 1.5;
  return 1;
};

/**
 * Coin earning eligibility:
 *   - Guests: no (not logged in)
 *   - Admins: no
 *   - Premium members WITHOUT an active subscription: no (per product spec,
 *     premium accounts don't earn; once their sub lapses they become free again
 *     via syncSubscriptionState and resume earning)
 * Subscribers with an ACTIVE subscription still earn (premium plan = 1.5× rate)
 * because they need coins to redeem.
 */
const canUserEarnCoins = (user: any): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return false;
  if (user.isPremium === true && !isSubscriptionActive(user)) return false;
  return true;
};

/**
 * Lazily expire coins older than COIN_TTL_MS. Called before every read/write.
 * Logs an `expired` transaction so the user's activity feed shows the drop.
 * Mutates the in-memory user doc; caller still needs to `.save()` if it changes.
 */
const expireStaleCoins = async (user: any): Promise<boolean> => {
  if (!user) return false;
  if (!user.cineCoins || user.cineCoins <= 0) {
    // Nothing to expire – just make sure stale expiry pointer is cleared
    if (user.coinsExpiryAt) {
      user.coinsExpiryAt = null;
      await user.save();
      return true;
    }
    return false;
  }
  if (user.coinsExpiryAt && new Date(user.coinsExpiryAt).getTime() <= Date.now()) {
    const lost = user.cineCoins;
    user.cineCoins = 0;
    user.coinsExpiryAt = null;
    await user.save();
    await CoinTransaction.create({
      userId: user._id,
      type: 'expired',
      amount: -lost,
      balanceAfter: 0,
      note: `Coins expired after 5 hours of non-redemption`,
    });
    return true;
  }
  return false;
};

const serializeUserCoins = (user: any) => ({
  cineCoins: user.cineCoins || 0,
  totalCoinsEarned: user.totalCoinsEarned || 0,
  watchTimeCounter: user.watchTimeCounter || 0,
  coinsExpiryAt: user.coinsExpiryAt || null,
  coinTtlMs: COIN_TTL_MS,
  subscriptionPlan: user.subscriptionPlan || null,
  subscriptionStartedAt: user.subscriptionStartedAt || null,
  subscriptionExpiresAt: user.subscriptionExpiresAt || null,
  subscriptionCancelledAt: user.subscriptionCancelledAt || null,
  subscriptionPaidINR: user.subscriptionPaidINR || 0,
  subscriptionLastPaymentAt: user.subscriptionLastPaymentAt || null,
  subscriptionActive: isSubscriptionActive(user),
  upiId: user.upiId || null,
  canEarnCoins: canUserEarnCoins(user),
});

/**
 * POST /api/users/coins/track
 * Body: { seconds: number, contentId?: string }
 * Client sends this periodically while the video is actively playing (not paused / not hidden).
 * Server accumulates seconds and every full COIN_EARN_SECONDS window awards coins.
 */
export const trackWatchTime = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { seconds, contentId } = req.body || {};

    // Load fresh user first so eligibility uses up-to-date subscription state
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Demote lapsed subscriptions back to free state (mutates + saves in place)
    await syncSubscriptionState(user);

    // Admin & inactive-premium accounts are not eligible for the loyalty programme.
    if (!canUserEarnCoins(user)) {
      return res.json({ ignored: true, reason: 'not eligible', ...serializeUserCoins(user) });
    }

    // Sanity clamp: never accept more than 5 minutes at once, must be positive
    const sec = Math.min(Math.max(Number(seconds) || 0, 0), 300);
    if (sec <= 0) {
      return res.json({ ignored: true, ...serializeUserCoins(user) });
    }

    // Expire any stale balance first so the new earn starts a fresh 5h window
    await expireStaleCoins(user);

    // Premium users still earn coins (they get 1.5× on Premium plan)
    let counter = (user.watchTimeCounter || 0) + sec;
    let earned = 0;
    const multiplier = planMultiplier(user.subscriptionPlan);

    while (counter >= COIN_EARN_SECONDS) {
      counter -= COIN_EARN_SECONDS;
      earned += Math.round(COIN_EARN_AMOUNT * multiplier);
    }

    if (earned > 0) {
      const hadNoBalance = !user.cineCoins || user.cineCoins <= 0;
      user.cineCoins = (user.cineCoins || 0) + earned;
      user.totalCoinsEarned = (user.totalCoinsEarned || 0) + earned;
      // First unspent coin in a new cycle → set expiry timestamp (5 hours from now)
      if (hadNoBalance || !user.coinsExpiryAt) {
        user.coinsExpiryAt = new Date(Date.now() + COIN_TTL_MS);
      }
      await CoinTransaction.create({
        userId: user._id,
        type: 'earned',
        amount: earned,
        balanceAfter: user.cineCoins,
        watchSeconds: COIN_EARN_SECONDS,
        contentId: contentId || undefined,
        note: `Watched ${COIN_EARN_SECONDS / 60} minutes`,
      });
    }

    user.watchTimeCounter = counter;
    await user.save();

    return res.json({
      earned,
      ...serializeUserCoins(user),
    });
  } catch (error) {
    console.error('trackWatchTime error:', error);
    return res.status(500).json({ message: 'Error tracking watch time' });
  }
};

/**
 * GET /api/users/coins
 * Returns current coin balance, subscription status, transaction history, redemptions.
 */
export const getUserCoins = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Demote lapsed subscriptions back to free state
    await syncSubscriptionState(user);

    // Lazily expire stale coins before showing the balance
    await expireStaleCoins(user);

    const [transactions, redemptions] = await Promise.all([
      CoinTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(60),
      Redemption.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30),
    ]);

    return res.json({
      ...serializeUserCoins(user),
      coinValueINR: COIN_VALUE_INR,
      earnRate: { seconds: COIN_EARN_SECONDS, coins: COIN_EARN_AMOUNT },
      transactions,
      redemptions,
    });
  } catch (error) {
    console.error('getUserCoins error:', error);
    return res.status(500).json({ message: 'Error fetching coins' });
  }
};

/**
 * POST /api/users/coins/redeem
 * Body: { coins: number, upiId: string }
 * Requires an active subscription.
 * Deducts coins immediately (they are held in the pending Redemption).
 * If admin rejects, coins are refunded via a 'refund' transaction.
 */
export const redeemCoins = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { coins, upiId } = req.body || {};

    const amount = Math.floor(Number(coins) || 0);
    const upi = String(upiId || '').trim();

    if (amount <= 0) return res.status(400).json({ message: 'Redemption amount must be at least 1 coin' });
    if (!upi || !/^[\w.\-]{2,}@[a-zA-Z]{2,}/.test(upi)) {
      return res.status(400).json({ message: 'Please provide a valid UPI ID (e.g. name@bank)' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Fresh state after any lazy expiry
    await expireStaleCoins(user);

    if (!isSubscriptionActive(user)) {
      return res.status(403).json({
        message: 'You need an active subscription plan to redeem CineCoins. Buy a plan to unlock redemption.',
      });
    }

    if ((user.cineCoins || 0) < amount) {
      return res.status(400).json({ message: `Only ${user.cineCoins || 0} coins available` });
    }

    user.cineCoins = (user.cineCoins || 0) - amount;
    user.upiId = upi;
    await user.save();

    const redemption = await Redemption.create({
      userId: user._id,
      coins: amount,
      amountINR: amount * COIN_VALUE_INR,
      upiId: upi,
      subscriptionPlan: user.subscriptionPlan,
      status: 'pending',
    });

    await CoinTransaction.create({
      userId: user._id,
      type: 'redeemed',
      amount: -amount,
      balanceAfter: user.cineCoins,
      redemptionId: redemption._id,
      note: `Redeemed ${amount} coins → ₹${amount * COIN_VALUE_INR} to ${upi}`,
    });

    return res.json({
      message: 'Redemption submitted. Admin will process your payout shortly.',
      redemption,
      ...serializeUserCoins(user),
    });
  } catch (error) {
    console.error('redeemCoins error:', error);
    return res.status(500).json({ message: 'Error processing redemption' });
  }
};

/**
 * POST /api/users/subscription/purchase
 * Body: { planId: string }
 * Mock payment (real gateway integration out of scope). Activates subscription for plan duration.
 */
export const purchaseSubscription = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { planId } = req.body || {};
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) return res.status(400).json({ message: 'Unknown plan' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    // Extend from current expiry if still active, else from now
    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    user.subscriptionPlan = plan.id;
    if (!user.subscriptionStartedAt) user.subscriptionStartedAt = now;
    user.subscriptionExpiresAt = newExpiry;
    user.subscriptionCancelledAt = null;
    user.subscriptionLastPaymentAt = now;
    user.subscriptionPaidINR = (user.subscriptionPaidINR || 0) + plan.priceINR;
    // Buying a subscription makes the user a PREMIUM member
    user.isPremium = true;
    await user.save();

    // Payment ledger entry (one per purchase) for admin visibility
    await SubscriptionPurchase.create({
      userId: user._id,
      planId: plan.id,
      planName: plan.name,
      priceINR: plan.priceINR,
      durationDays: plan.durationDays,
      startedAt: now,
      expiresAt: newExpiry,
      status: 'active',
    });

    return res.json({
      message: `Subscribed to ${plan.name}! You are now a Premium member and can redeem CineCoins to your UPI.`,
      plan,
      ...serializeUserCoins(user),
    });
  } catch (error) {
    console.error('purchaseSubscription error:', error);
    return res.status(500).json({ message: 'Error activating subscription' });
  }
};

/**
 * GET /api/users/subscription/plans
 * Public list of subscription plans.
 */
export const listSubscriptionPlans = async (_req: AuthRequest, res: Response) => {
  return res.json({
    plans: SUBSCRIPTION_PLANS,
    coinValueINR: COIN_VALUE_INR,
    earnRate: { seconds: COIN_EARN_SECONDS, coins: COIN_EARN_AMOUNT },
  });
};

/**
 * POST /api/users/coins/upi
 * Body: { upiId }
 * Save UPI ID for the user (so they don't have to retype).
 */
export const saveUpiId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const upi = String(req.body?.upiId || '').trim();
    if (!upi || !/^[\w.\-]{2,}@[a-zA-Z]{2,}/.test(upi)) {
      return res.status(400).json({ message: 'Invalid UPI ID format' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { upiId: upi }, { new: true });
    return res.json({ message: 'UPI saved', upiId: user?.upiId || null });
  } catch (error) {
    return res.status(500).json({ message: 'Error saving UPI' });
  }
};

// ---------- ADMIN ----------

/**
 * GET /api/admin/redemptions
 * Lists all redemptions with user info populated. Filter by status.
 */
export const adminListRedemptions = async (req: AuthRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || 'all';
    const filter: any = {};
    if (status !== 'all') filter.status = status;
    const redemptions = await Redemption.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('userId', 'name email cineCoins totalCoinsEarned subscriptionPlan subscriptionExpiresAt upiId');
    return res.json({ redemptions });
  } catch (error) {
    return res.status(500).json({ message: 'Error listing redemptions' });
  }
};

/**
 * POST /api/admin/redemptions/:id/approve
 * Marks as approved. Coins are already deducted (they stay deducted).
 */
export const adminApproveRedemption = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const redemption = await Redemption.findById(id);
    if (!redemption) return res.status(404).json({ message: 'Redemption not found' });
    redemption.status = 'approved';
    redemption.adminNote = req.body?.adminNote || redemption.adminNote;
    redemption.processedAt = new Date();
    await redemption.save();
    return res.json({ message: 'Redemption approved', redemption });
  } catch (error) {
    return res.status(500).json({ message: 'Error approving redemption' });
  }
};

/**
 * POST /api/admin/redemptions/:id/reject
 * Marks as rejected and REFUNDS the coins back to the user's balance.
 */
export const adminRejectRedemption = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const redemption = await Redemption.findById(id);
    if (!redemption) return res.status(404).json({ message: 'Redemption not found' });
    if (redemption.status === 'rejected') {
      return res.status(400).json({ message: 'Already rejected' });
    }
    redemption.status = 'rejected';
    redemption.adminNote = req.body?.adminNote || redemption.adminNote;
    redemption.processedAt = new Date();
    await redemption.save();

    // Refund coins
    const user = await User.findById(redemption.userId);
    if (user) {
      user.cineCoins = (user.cineCoins || 0) + redemption.coins;
      await user.save();
      await CoinTransaction.create({
        userId: user._id,
        type: 'refund',
        amount: redemption.coins,
        balanceAfter: user.cineCoins,
        redemptionId: redemption._id,
        note: `Refund of rejected redemption (${redemption.adminNote || 'no reason provided'})`,
      });
    }

    return res.json({ message: 'Redemption rejected and coins refunded', redemption });
  } catch (error) {
    return res.status(500).json({ message: 'Error rejecting redemption' });
  }
};

/**
 * GET /api/admin/coins/stats
 */
export const adminCoinsStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [totalEarnedAgg, totalRedeemedAgg, pendingCount, subscriberCount] = await Promise.all([
      CoinTransaction.aggregate([{ $match: { type: 'earned' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Redemption.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, coins: { $sum: '$coins' }, inr: { $sum: '$amountINR' } } },
      ]),
      Redemption.countDocuments({ status: 'pending' }),
      User.countDocuments({
        subscriptionPlan: { $ne: null },
        subscriptionExpiresAt: { $gt: new Date() },
      }),
    ]);

    return res.json({
      totalCoinsEarned: totalEarnedAgg[0]?.total || 0,
      totalCoinsRedeemed: totalRedeemedAgg[0]?.coins || 0,
      totalPayoutINR: totalRedeemedAgg[0]?.inr || 0,
      pendingRedemptions: pendingCount,
      activeSubscribers: subscriberCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error loading coin stats' });
  }
};

// ---------- ADMIN: PREMIUM MEMBERSHIP MANAGEMENT ----------

/**
 * GET /api/admin/subscribers?status=all|active|expired|cancelled&q=search
 * Lists all users who ever bought a subscription with payment info + purchase history.
 */
export const adminListSubscribers = async (req: AuthRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || 'all';
    const q = ((req.query.q as string) || '').trim();

    const filter: any = { subscriptionPlan: { $ne: null } };
    if (status === 'active') {
      filter.subscriptionExpiresAt = { $gt: new Date() };
      filter.subscriptionCancelledAt = null;
    } else if (status === 'expired') {
      filter.subscriptionExpiresAt = { $lte: new Date() };
      filter.subscriptionCancelledAt = null;
    } else if (status === 'cancelled') {
      filter.subscriptionCancelledAt = { $ne: null };
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .sort({ subscriptionPaidINR: -1, subscriptionExpiresAt: -1 })
      .limit(200)
      .select('name email isPremium cineCoins totalCoinsEarned subscriptionPlan subscriptionStartedAt subscriptionExpiresAt subscriptionCancelledAt subscriptionPaidINR subscriptionLastPaymentAt upiId createdAt');

    // Attach purchase ledger for each displayed user
    const ids = users.map((u: any) => u._id);
    const purchases = await SubscriptionPurchase.find({ userId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('userId planId planName priceINR durationDays startedAt expiresAt status cancelledAt cancelNote createdAt');

    const byUser = new Map<string, any[]>();
    purchases.forEach((p: any) => {
      const key = String(p.userId);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(p);
    });

    const now = Date.now();
    const result = users.map((u: any) => {
      const active =
        !!u.subscriptionPlan &&
        !u.subscriptionCancelledAt &&
        u.subscriptionExpiresAt &&
        new Date(u.subscriptionExpiresAt).getTime() > now;
      return {
        user: {
          _id: u._id,
          name: u.name,
          email: u.email,
          isPremium: u.isPremium,
          cineCoins: u.cineCoins || 0,
          totalCoinsEarned: u.totalCoinsEarned || 0,
          upiId: u.upiId || null,
          createdAt: u.createdAt,
        },
        subscription: {
          plan: u.subscriptionPlan || null,
          startedAt: u.subscriptionStartedAt || null,
          expiresAt: u.subscriptionExpiresAt || null,
          cancelledAt: u.subscriptionCancelledAt || null,
          paidINR: u.subscriptionPaidINR || 0,
          lastPaymentAt: u.subscriptionLastPaymentAt || null,
          active,
        },
        purchases: byUser.get(String(u._id)) || [],
      };
    });

    // Revenue stats
    const totalRevenueAgg = await SubscriptionPurchase.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$priceINR' }, count: { $sum: 1 } } },
    ]);

    return res.json({
      subscribers: result,
      stats: {
        totalRevenueINR: totalRevenueAgg[0]?.total || 0,
        totalPurchases: totalRevenueAgg[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('adminListSubscribers error:', error);
    return res.status(500).json({ message: 'Error listing subscribers' });
  }
};

/**
 * POST /api/admin/subscribers/:userId/cancel
 * Body: { note?: string }
 * Admin cancels a premium membership immediately: expiry pulled to now,
 * premium badge removed, active purchase ledger entries marked cancelled.
 */
export const adminCancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const note = String(req.body?.note || '').trim() || null;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.subscriptionPlan) return res.status(400).json({ message: 'User has no subscription' });

    const now = new Date();
    user.subscriptionExpiresAt = now;
    user.subscriptionCancelledAt = now;
    user.isPremium = false;
    await user.save();

    await SubscriptionPurchase.updateMany(
      { userId: user._id, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: now, cancelNote: note } }
    );

    return res.json({ message: 'Subscription cancelled', user: serializeUserCoins(user) });
  } catch (error) {
    console.error('adminCancelSubscription error:', error);
    return res.status(500).json({ message: 'Error cancelling subscription' });
  }
};

/**
 * POST /api/admin/subscribers/:userId/extend
 * Body: { days: number, note?: string }
 * Admin grants extra premium days (e.g. support goodwill or manual payment).
 * Cancels any pending cancellation state and re-premiums the user.
 */
export const adminExtendSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const days = Math.floor(Number(req.body?.days) || 0);
    if (days <= 0 || days > 3650) {
      return res.status(400).json({ message: 'days must be between 1 and 3650' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    user.subscriptionExpiresAt = newExpiry;
    user.subscriptionCancelledAt = null;
    if (!user.subscriptionPlan) user.subscriptionPlan = 'pro'; // default plan for manual grants
    if (!user.subscriptionStartedAt) user.subscriptionStartedAt = now;
    user.isPremium = true;
    await user.save();

    await SubscriptionPurchase.create({
      userId: user._id,
      planId: 'admin-grant',
      planName: `Admin grant (${days} days)`,
      priceINR: 0,
      durationDays: days,
      startedAt: now,
      expiresAt: newExpiry,
      status: 'active',
    });

    return res.json({ message: `Extended subscription by ${days} days`, user: serializeUserCoins(user) });
  } catch (error) {
    console.error('adminExtendSubscription error:', error);
    return res.status(500).json({ message: 'Error extending subscription' });
  }
};

/**
 * GET /api/admin/subscribers/:userId/purchases
 * Full payment history for one subscriber.
 */
export const adminSubscriberPurchases = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const purchases = await SubscriptionPurchase.find({ userId }).sort({ createdAt: -1 });
    return res.json({ purchases });
  } catch (error) {
    return res.status(500).json({ message: 'Error loading purchases' });
  }
};
