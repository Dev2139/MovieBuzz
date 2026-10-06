import mongoose, { Schema, Document } from 'mongoose';

export type QualityType = '1080p' | '720p' | '480p' | '4K';

export interface IMedia extends Document {
  contentId?: mongoose.Types.ObjectId;
  episodeId?: mongoose.Types.ObjectId;
  quality: QualityType;
  resolution: string;
  fileSize: string; // e.g. "1.4 GB"
  duration: number; // seconds
  mimeType: string;
  provider: 'mock' | 'telegram' | 's3' | 'r2' | 'bunny';
  providerMediaId: string;
  providerMessageId?: string;
  streamUrl: string;
  downloadUrl: string;
  status: 'active' | 'processing' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema: Schema = new Schema(
  {
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', index: true },
    quality: { type: String, enum: ['1080p', '720p', '480p', '4K'], required: true },
    resolution: { type: String, default: '1920x1080' },
    fileSize: { type: String, default: '1.2 GB' },
    duration: { type: Number, default: 0 },
    mimeType: { type: String, default: 'video/mp4' },
    provider: { type: String, enum: ['mock', 'telegram', 's3', 'r2', 'bunny'], default: 'mock' },
    providerMediaId: { type: String, required: true },
    providerMessageId: { type: String },
    streamUrl: { type: String, required: true },
    downloadUrl: { type: String, required: true },
    status: { type: String, enum: ['active', 'processing', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
