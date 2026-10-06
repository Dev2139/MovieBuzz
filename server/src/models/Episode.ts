import mongoose, { Schema, Document } from 'mongoose';

export interface IEpisode extends Document {
  seriesId: mongoose.Types.ObjectId;
  seasonId: mongoose.Types.ObjectId;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  releaseDate: Date;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema: Schema = new Schema(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true, index: true },
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, required: true },
    duration: { type: Number, required: true, default: 0 },
    releaseDate: { type: Date, default: Date.now },
    rating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

EpisodeSchema.index({ seasonId: 1, episodeNumber: 1 }, { unique: true });

export const Episode = mongoose.model<IEpisode>('Episode', EpisodeSchema);
