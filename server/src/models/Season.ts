import mongoose, { Schema, Document } from 'mongoose';

export interface ISeason extends Document {
  seriesId: mongoose.Types.ObjectId;
  seasonNumber: number;
  title: string;
  description: string;
  posterUrl: string;
  releaseYear: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeasonSchema: Schema = new Schema(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    seasonNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    posterUrl: { type: String, default: '' },
    releaseYear: { type: Number, required: true },
  },
  { timestamps: true }
);

SeasonSchema.index({ seriesId: 1, seasonNumber: 1 }, { unique: true });

export const Season = mongoose.model<ISeason>('Season', SeasonSchema);
