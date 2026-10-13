import mongoose, { Schema, Document } from 'mongoose';

export type RequestStatus = 'pending' | 'fulfilled' | 'rejected';

export interface IContentRequest extends Document {
  title: string;
  normalizedTitle: string;
  type: 'movie' | 'series';
  releaseYear?: number;
  notes?: string;
  requestedBy?: mongoose.Types.ObjectId;
  userName?: string;
  userEmail?: string;
  votes: mongoose.Types.ObjectId[];   // community "me too" upvotes
  status: RequestStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentRequestSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    // Lowercased, punctuation-free title used to merge duplicate community requests
    normalizedTitle: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ['movie', 'series'], default: 'movie', index: true },
    releaseYear: { type: Number },
    notes: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

ContentRequestSchema.index({ createdAt: -1 });
ContentRequestSchema.index({ status: 1, normalizedTitle: 1 });

export const normalizeRequestTitle = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

export const ContentRequest = mongoose.model<IContentRequest>(
  'ContentRequest',
  ContentRequestSchema
);
