import dotenv from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

dotenv.config();

async function testFetch() {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const channelId = process.env.TELEGRAM_CHANNEL_ID || '@devcinestreambot';

  console.log('[TestFetch] Starting MTProto Bot Client...');
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3 });
  await client.start({ botAuthToken: botToken });
  console.log('[TestFetch] Connected!');

  console.log(`[TestFetch] Resolving entity for ${channelId}...`);
  const peer = await client.getEntity(channelId).catch((err) => {
    console.error('[TestFetch] getEntity error:', err.message);
    return null;
  });

  if (peer) {
    console.log('[TestFetch] Found Peer entity:', peer);
    const msgs = await client.getMessages(peer as any, { ids: [795] }).catch((err) => {
      console.error('[TestFetch] getMessages error:', err.message);
      return [];
    });

    console.log('[TestFetch] Fetched messages count:', msgs.length);
    for (const m of msgs) {
      console.log('Message ID:', m?.id);
      console.log('Message Text/Caption:', m?.message);
      console.log('Message Media:', m?.media);
    }
  }

  await client.disconnect();
  process.exit(0);
}

testFetch().catch(console.error);
