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

  const version = '2.4.0';
  const versionCode = 24;
  const title = 'Cinema Video Sponsor Engine & Active Chunk Streaming System';
  const changelog =
    '• Cinema Sponsor Video Ad Integration: Full high-definition sponsor video plays seamlessly before stream startup\n' +
    '• Zero-Lag Stream Background Priming: Main media chunks prefetch in real time while the sponsor video is playing\n' +
    '• Continuous Active Playback Prefetching: Successive chunks download uninterrupted during playback\n' +
    '• Intelligent Pause Caching: Streams never halt chunk downloads when paused, ensuring instant zero-delay playback resume\n' +
    '• Live Buffer Meter: Real-time chunk buffer and edge cache telemetry in both player and pre-roll ad screens\n' +
    '• Audio Mute / Unmute Controls for Sponsor Video Ad\n' +
    '• Enhanced Cloudflare Edge Worker stream routing for highest bitrate stability';

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
      body: `${title}\nTap to install the new update with zero-latency background chunk caching!`,
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
    apkSize: '53 MB',
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
