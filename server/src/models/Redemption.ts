import mongoose, { Schema, Document } from 'mongoose';

export interface IRedemption extends Document {
  userId: mongoose.Types.ObjectId;
  coins: number;                  // number of CineCoins being redeemed
  amountINR: number;              // rupees paid out to the user (1 coin = ₹1)
  upiId: string;                  // user's UPI address at time of redemption
  subscriptionPlan: string;       // plan active at time of redemption (audit)
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RedemptionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coins: { type: Number, required: true, min: 1 },
    amountINR: { type: Number, required: true, min: 1 },
    upiId: { type: String, required: true, trim: true },
    subscriptionPlan: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const Redemption = mongoose.model<IRedemption>('Redemption', RedemptionSchema);
