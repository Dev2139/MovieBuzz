import mongoose, { Schema, Document } from 'mongoose';

/**
 * Payment ledger for subscription purchases.
 * One document per purchase — lets the admin see who paid how much, when,
 * and for how long. Also used to compute lifetime revenue per user.
 */
export interface ISubscriptionPurchase extends Document {
  userId: mongoose.Types.ObjectId;
  planId: string;          // 'basic' | 'pro' | 'premium'
  planName: string;
  priceINR: number;
  durationDays: number;
  startedAt: Date;
  expiresAt: Date;         // expiry computed at time of purchase
  status: 'active' | 'expired' | 'cancelled';
  cancelledAt: Date | null;
  cancelNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPurchaseSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    priceINR: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    cancelledAt: { type: Date, default: null },
    cancelNote: { type: String, default: null },
  },
  { timestamps: true }
);

export const SubscriptionPurchase = mongoose.model<ISubscriptionPurchase>(
  'SubscriptionPurchase',
  SubscriptionPurchaseSchema
);
