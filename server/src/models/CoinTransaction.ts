import mongoose, { Schema, Document } from 'mongoose';

export interface ICoinTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'earned' | 'redeemed' | 'refund' | 'admin-adjust' | 'expired';
  amount: number;                 // signed: positive for earn/refund, negative for redeem
  balanceAfter: number;
  watchSeconds?: number;          // only for 'earned' — how many active seconds caused this entry
  contentId?: mongoose.Types.ObjectId;
  redemptionId?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
}

const CoinTransactionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['earned', 'redeemed', 'refund', 'admin-adjust', 'expired'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    watchSeconds: { type: Number },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content' },
    redemptionId: { type: Schema.Types.ObjectId, ref: 'Redemption' },
    note: { type: String },
  },
  { timestamps: true }
);

export const CoinTransaction = mongoose.model<ICoinTransaction>(
  'CoinTransaction',
  CoinTransactionSchema
);
