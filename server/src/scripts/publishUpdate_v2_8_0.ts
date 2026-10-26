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

  const version = '2.8.0';
  const versionCode = 28;
  const title = 'MovieBuzz v2.8.0 — Smart Offline Mode, Slow Network Auto-Redirect & Zero-Buffer Playback';
  const changelog =
    '• Smart Offline & Slow Network Detection: Automatically senses lost or slow internet connection on the Home page with instant one-tap redirect to Downloads\n' +
    '• Unified Offline Downloads Hub: Easily view, filter, and enjoy all downloaded movies and series in one place\n' +
    '• Dedicated Empty State: Clean "No Downloaded Content" display with offline tips when device storage has no downloaded titles\n' +
    '• 100% Zero-Data Offline Playback: Play downloaded movies and series episodes with ZERO internet connectivity, zero ads, and zero buffering\n' +
    '• Official Website Installation Hub: Seamlessly download and install new releases directly from the MovieBuzz website\n' +
    '• Performance & Edge Sync: Faster boot times, background latency monitoring, and instant video initialization';

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
      body: `MovieBuzz v${version} is now available! Enjoy smart offline mode with slow network auto-redirect to downloads, movie & series filters, and zero-data playback. Tap to install the latest version from our website.`,
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
