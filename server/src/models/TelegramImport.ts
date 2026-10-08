import mongoose, { Schema, Document } from 'mongoose';

export type ImportStatus = 'PENDING' | 'REVIEWED' | 'IMPORTED' | 'IGNORED' | 'DELETED' | 'ERROR';

export interface ITelegramImport extends Document {
  channelId: string;
  messageId: string;
  mediaId: string;
  originalCaption: string;
  detectedTitle: string;
  detectedSeason?: number;
  detectedEpisode?: number;
  detectedEpisodeEnd?: number;
  detectedQuality?: string;
  detectedYear?: number;
  detectedLanguage?: string;
  status: ImportStatus;
  mappedContentId?: mongoose.Types.ObjectId;
  mappedEpisodeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TelegramImportSchema: Schema = new Schema(
  {
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    mediaId: { type: String, required: true },
    originalCaption: { type: String, required: true },
    detectedTitle: { type: String, required: true },
    detectedSeason: { type: Number },
    detectedEpisode: { type: Number },
    detectedEpisodeEnd: { type: Number },
    detectedQuality: { type: String, default: '1080p' },
    detectedYear: { type: Number },
    detectedLanguage: { type: String, default: 'English' },
    status: {
      type: String,
      enum: ['PENDING', 'REVIEWED', 'IMPORTED', 'IGNORED', 'DELETED', 'ERROR'],
      default: 'PENDING',
      index: true,
    },
    mappedContentId: { type: Schema.Types.ObjectId, ref: 'Content' },
    mappedEpisodeId: { type: Schema.Types.ObjectId, ref: 'Episode' },
  },
  { timestamps: true }
);

export const TelegramImport = mongoose.model<ITelegramImport>('TelegramImport', TelegramImportSchema);
