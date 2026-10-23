import mongoose, { Schema, Document } from 'mongoose';

export interface IAppUpdate extends Document {
  version: string;
  versionCode: number;
  title: string;
  changelog: string;
  downloadUrl: string;
  apkSize: string;
  isMandatory: boolean;
  isActive: boolean;
  usersNotifiedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AppUpdateSchema: Schema = new Schema(
  {
    version: { type: String, required: true, trim: true, index: true },
    versionCode: { type: Number, required: true, index: true },
    title: { type: String, required: true, trim: true },
    changelog: { type: String, required: true },
    downloadUrl: { type: String, default: '/moviebuzz.apk', trim: true },
    apkSize: { type: String, default: '55 MB', trim: true },
    isMandatory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    usersNotifiedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AppUpdateSchema.index({ createdAt: -1 });

export const AppUpdate = mongoose.model<IAppUpdate>('AppUpdate', AppUpdateSchema);
