import mongoose, { Schema, Document } from 'mongoose';

export type ContentType = 'movie' | 'series';

export interface IContent extends Document {
  title: string;
  slug: string;
  type: ContentType;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string;
  releaseYear: number;
  releaseDate?: Date;
  genres: string[];
  languages: string[];
  cast: string[];
  director?: string;
  rating: number; // e.g. 8.5
  popularity: number; // view count or index
  featured: boolean;
  status: 'published' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['movie', 'series'], required: true, index: true },
    description: { type: String, required: true },
    posterUrl: { type: String, required: true },
    backdropUrl: { type: String, required: true },
    trailerUrl: { type: String, default: '' },
    releaseYear: { type: Number, required: true, index: true },
    releaseDate: { type: Date, index: true },
    genres: [{ type: String, index: true }],
    languages: [{ type: String, index: true }],
    cast: [{ type: String }],
    director: { type: String, default: '' },
    rating: { type: Number, default: 0, index: true },
    popularity: { type: Number, default: 0, index: true },
    featured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['published', 'draft'], default: 'published', index: true },
  },
  { timestamps: true }
);

// Text search index for quick full-text search
ContentSchema.index({
  title: 'text',
  description: 'text',
  cast: 'text',
  director: 'text',
  genres: 'text',
});

export const Content = mongoose.model<IContent>('Content', ContentSchema);
