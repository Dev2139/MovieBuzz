import dotenv from 'dotenv';
import readline from 'readline';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID || 39243219);
  const apiHash = process.env.TELEGRAM_API_HASH || '1d2a346250ff0e4861180d9cfff67cb0';

  console.log('================================================================');
  console.log(' 🔑 Telegram User Session Generator for CineStream');
  console.log('================================================================');
  console.log('This will create a permanent MTProto Session String so movies of');
  console.log('any size (GBs) stream instantly with ZERO Telegram Bot limits!\n');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await question('📱 Enter your Telegram Phone Number (e.g. +919876543210): '),
    password: async () => await question('🔑 Enter Two-Step Verification Password (if enabled): '),
    phoneCode: async () => await question('📩 Enter 5-digit Login Code sent to your Telegram App: '),
    onError: (err) => console.error('Error:', err.message),
  });

  console.log('\n🎉 SUCCESS! You are logged in as:', (await client.getMe()).firstName);
  const sessionString = client.session.save();

  console.log('\n================================================================');
  console.log('Copy and paste the line below into your server/.env file:');
  console.log('================================================================\n');
  console.log(`TELEGRAM_SESSION_STRING=${sessionString}\n`);
  console.log('================================================================\n');

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nInitialization error:', err.message);
  rl.close();
  process.exit(1);
});
