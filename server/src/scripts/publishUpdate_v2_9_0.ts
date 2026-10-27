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

  const version = '2.9.0';
  const versionCode = 29;
  const title = 'MovieBuzz v2.9.0 — Cloudflare Edge Streaming & Website Update Hub';
  const changelog =
    '• Cloudflare Edge High-Speed Streaming: 100% free unmetered edge bandwidth for instantaneous video playback\n' +
    '• Direct Website APK Download: Seamless one-tap redirect to website download hub for easy updates\n' +
    '• Dedicated In-App Update Screen: Full-screen clean update dashboard with changelog details (zero popups)\n' +
    '• High-Performance MP4 Downloads: Lightning-fast multi-threaded video downloads powered by Cloudflare CDN\n' +
    '• Offline Downloads Hub: Watch downloaded movies & web series with zero internet connection';

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
      body: `MovieBuzz v${version} is now available! Enjoy zero-lag Cloudflare streaming, offline mode, and high-speed downloads. Tap here to download and install from our official website.`,
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
  console.log(`✅ App update v${version} (versionCode: ${versionCode}) published successfully! Broadcast notification sent to ${notifiedCount} registered users in MongoDB.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to publish app update:', err);
  process.exit(1);
});
