import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
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

  const version = '2.3.0';
  const versionCode = 23;
  const title = 'Zero-Lag Stream Prefetching & Cinema Pre-Roll Engine';
  const changelog =
    '• Cinema Sponsor Pre-Roll Ad before streaming begins with skip controls\n' +
    '• Advanced Background Chunk Buffer: Streams prefetch byte-ranges ahead while the ad is playing\n' +
    '• Continuous Background Chunk Engine: Downloads subsequent chunks uninterrupted while playing\n' +
    '• Smart Pause Caching: Continues downloading stream chunks even while paused for instant zero-latency playback\n' +
    '• Dedicated Web Installation Hub with seamless APK downloads & dynamic updates\n' +
    '• Ultra-smooth high bitrate video playback engine with enhanced buffer resilience';

  // Deactivate previous releases
  await AppUpdate.updateMany({}, { $set: { isActive: false } });

  // Broadcast system notifications to all users
  const users = await User.find({}, '_id');
  let notifiedCount = 0;
  if (users.length > 0) {
    const notifications = users.map((u) => ({
      userId: u._id,
      type: 'system',
      title: `🎬 New App Update v${version} Available!`,
      body: `${title}\nInstant download with continuous zero-lag background chunk prefetching!`,
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
    apkSize: '58 MB',
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
