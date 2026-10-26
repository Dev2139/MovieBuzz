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
  console.log('Connected to MongoDB.');

  const version = '2.6.0';
  const versionCode = 26;
  const title = 'MovieBuzz v2.6.0 — High-Speed Cloud Backend & Zero-Buffer Playback';
  const changelog =
    '• Updated Cloud Backend: Direct high-speed connection to Render production API (moviebuzz-qr1i.onrender.com/api)\n' +
    '• Buffer-Free Edge Streaming: Cloudflare Edge Worker integration for instantaneous startup and zero lag\n' +
    '• Seamless Cloud Sync: Real-time synchronization of watch progress, continue watching, and watchlist\n' +
    '• Enhanced Media Controller: Dynamic quality selector (4K/1080p/720p/480p), multi-track audio, and aspect ratio modes\n' +
    '• Live In-App Update Engine: Automatic notification alerts and direct APK installation\n' +
    '• Performance & Memory Optimizations: Silky smooth 120Hz navigation with minimal battery consumption';

  // Calculate APK file size if built
  let apkSize = '54 MB';
  const apkPath = path.resolve(__dirname, '../../../client/public/moviebuzz.apk');
  if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    apkSize = `${Math.round(stats.size / (1024 * 1024))} MB`;
  }

  // Deactivate previous releases
  await AppUpdate.updateMany({}, { $set: { isActive: false } });

  // Broadcast system notifications to all users
  const users = await User.find({}, '_id');
  let notifiedCount = 0;
  if (users.length > 0) {
    const notifications = users.map((u) => ({
      userId: u._id,
      type: 'system',
      title: `⚡ New App Update v${version} Released!`,
      body: `MovieBuzz v${version} is now live with our updated cloud backend (moviebuzz-qr1i.onrender.com)! Tap to download and install.`,
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
  console.log(`✅ App update v${version} published successfully! Broadcast notification sent to ${notifiedCount} registered users.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to publish app update:', err);
  process.exit(1);
});
