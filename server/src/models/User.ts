import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'user' | 'admin';
  isPremium?: boolean;
  favorites: mongoose.Types.ObjectId[];
  watchlist: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium: { type: Boolean, default: false },
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
    watchlist: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
