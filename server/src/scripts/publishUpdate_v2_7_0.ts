import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AppUpdate } from '../models/AppUpdate';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas.');

  const version = '2.7.0';
  const versionCode = 27;
  const title = 'MovieBuzz v2.7.0 — In-App Offline Downloads & Playable Media Engine';
  const changelog =
    '• In-App Offline Downloads: Download complete movies and series to watch anywhere without internet connectivity\n' +
    '• On-Device Private Caching: Stored safely in sandboxed device storage with ZERO database overhead and no clutter in external galleries\n' +
    '• Direct Playable Media Streams: Web & mobile streams download as standard, high-bitrate playable MP4 files compatible with VLC and all players\n' +
    '• Dedicated Offline Video Player: In-app playback with instant launch, fullscreen controls, and 0 ads or network buffering\n' +
    '• Updated Cloud Backend: Direct connection to production API (moviebuzz-qr1i.onrender.com/api) with Cloudflare edge acceleration\n' +
    '• Enhanced Downloads Manager: Live progress indicator, file size tracking, and one-tap storage cleanup';

  // Calculate APK file size
  let apkSize = '54 MB';
  const apkPath = path.resolve(__dirname, '../../../client/public/moviebuzz.apk');
  if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    apkSize = `${Math.round(stats.size / (1024 * 1024))} MB`;
  }

  // Deactivate previous releases
  await AppUpdate.updateMany({}, { $set: { isActive: false } });

  // Broadcast system notifications to all registered users
  const users = await User.find({}, '_id');
  let notifiedCount = 0;
  if (users.length > 0) {
    const notifications = users.map((u) => ({
      userId: u._id,
      type: 'system',
      title: `⚡ New App Update v${version} Released!`,
      body: `MovieBuzz v${version} is now live! Download full movies to watch offline directly in the app, plus direct playable MP4 streams. Tap to install the latest version.`,
      link: '/download',
      read: false,
    }));

    await Notification.insertMany(notifications, { ordered: false });
    notifiedCount = users.length;
  }

  const appUpdate = new AppUpdate({
    version,
    versionCode,
    title,
    changelog,
    downloadUrl: '/moviebuzz.apk',
    apkSize,
    isMandatory: false,
    isActive: true,
    usersNotifiedCount: notifiedCount,
  });

  await appUpdate.save();
  console.log(`✅ App update v${version} published successfully! Broadcast notification sent to ${notifiedCount} registered users in MongoDB.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to publish app update:', err);
  process.exit(1);
});
