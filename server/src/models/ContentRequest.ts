import mongoose, { Schema, Document } from 'mongoose';

export type RequestStatus = 'pending' | 'fulfilled' | 'rejected';

export interface IContentRequest extends Document {
  title: string;
  type: 'movie' | 'series';
  releaseYear?: number;
  notes?: string;
  requestedBy?: mongoose.Types.ObjectId;
  userName?: string;
  userEmail?: string;
  status: RequestStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentRequestSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['movie', 'series'], default: 'movie', index: true },
    releaseYear: { type: Number },
    notes: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true },
    userEmail: { type: String, trim: true },
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

export const ContentRequest = mongoose.model<IContentRequest>(
  'ContentRequest',
  ContentRequestSchema
);
