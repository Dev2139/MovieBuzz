import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
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

  const title = '📲 Install MovieBuzz Android App v2.4.0';
  const body = 'Latest update with full HD sponsor video ad & continuous background stream pre-buffering (active while playing & paused) is now ready to download!';
  const link = '/download';

  const users = await User.find({}, '_id');
  if (users.length > 0) {
    const notifications = users.map((u) => ({
      userId: u._id,
      type: 'system',
      title,
      body,
      link,
      read: false,
    }));

    await Notification.insertMany(notifications, { ordered: false });
    console.log(`✅ Admin notification successfully broadcast to ${users.length} registered users!`);
  } else {
    console.log('No users found to notify.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to broadcast admin notification:', err);
  process.exit(1);
});
