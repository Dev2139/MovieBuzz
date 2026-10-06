import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  episodeId?: mongoose.Types.ObjectId;
  progress: number; // in seconds
  duration: number; // in seconds
  completed: boolean;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WatchHistorySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', index: true },
    progress: { type: Number, required: true, default: 0 },
    duration: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

WatchHistorySchema.index({ userId: 1, contentId: 1 });
WatchHistorySchema.index({ userId: 1, episodeId: 1 });
WatchHistorySchema.index({ userId: 1, lastWatchedAt: -1 });

export const WatchHistory = mongoose.model<IWatchHistory>('WatchHistory', WatchHistorySchema);
