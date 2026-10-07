import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../server/.env') });

import { connectDB } from '../server/src/config/db';
import { TelegramMediaProvider } from '../server/src/services/telegram/telegramClient';

async function run() {
  await connectDB();
  const provider = new TelegramMediaProvider();
  console.log('Running syncChannelPosts()...');
  const count = await provider.syncChannelPosts();
  console.log(`SYNC RESULT: ${count} posts processed & published!`);
  process.exit(0);
}

run();
