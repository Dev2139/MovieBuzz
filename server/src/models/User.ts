import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'user' | 'admin';
  isPremium?: boolean;
  favorites: mongoose.Types.ObjectId[];
  watchlist: mongoose.Types.ObjectId[];
  preferredGenres?: string[];

  // CineCoins loyalty system
  cineCoins: number;               // spendable / redeemable balance
  totalCoinsEarned: number;        // lifetime counter (for stats only)
  watchTimeCounter: number;        // pending seconds not yet converted into coins
  coinsExpiryAt: Date | null;      // coins expire 5 hours after first unspent earn (unless redeemed)
  subscriptionPlan: string | null; // 'basic' | 'pro' | 'premium'
  subscriptionStartedAt: Date | null;
  subscriptionExpiresAt: Date | null;
  subscriptionCancelledAt: Date | null;  // set when admin cancels the membership
  subscriptionPaidINR: number;           // lifetime amount the user paid for subscriptions
  subscriptionLastPaymentAt: Date | null; // most recent payment date
  upiId: string | null;            // saved for redemption payouts

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium: { type: Boolean, default: false },
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
    watchlist: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
    preferredGenres: [{ type: String, trim: true }],

    // CineCoins defaults
    cineCoins: { type: Number, default: 0, min: 0 },
    totalCoinsEarned: { type: Number, default: 0 },
    watchTimeCounter: { type: Number, default: 0 },
    coinsExpiryAt: { type: Date, default: null },
    subscriptionPlan: { type: String, default: null },
    subscriptionStartedAt: { type: Date, default: null },
    subscriptionExpiresAt: { type: Date, default: null },
    subscriptionCancelledAt: { type: Date, default: null },
    subscriptionPaidINR: { type: Number, default: 0 },
    subscriptionLastPaymentAt: { type: Date, default: null },
    upiId: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
