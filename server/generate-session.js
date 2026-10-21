/**
 * Zero-dependency Telegram String Session Generator for CineStream
 * Run with: node generate-session.js
 */
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
require('dotenv').config({ path: '.env' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const apiId = parseInt(process.env.TELEGRAM_API_ID || '2040', 10);
const apiHash = process.env.TELEGRAM_API_HASH || 'b18441a1ff607e10a989891a5462e627';

(async () => {
  console.log('\n======================================================');
  console.log('   CineStream Telegram String Session Generator');
  console.log('======================================================\n');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });

  try {
    await client.start({
      phoneNumber: async () => (await ask('📱 Enter your Telegram phone number (with country code, e.g. +91...): ')).trim(),
      password: async () => (await ask('🔐 Enter your 2FA password (if enabled, or press Enter to skip): ')).trim(),
      phoneCode: async () => (await ask('💬 Enter the verification code sent to your Telegram app: ')).trim(),
      onError: (err) => console.error('Authentication Notice:', err.message),
    });

    console.log('\n✅ Successfully Authenticated with Telegram MTProto!');
    const sessionString = client.session.save();

    console.log('\n------------------------------------------------------');
    console.log('YOUR NEW TELEGRAM_SESSION_STRING:');
    console.log('------------------------------------------------------\n');
    console.log(sessionString);
    console.log('\n------------------------------------------------------');
    console.log('👉 Next Steps:');
    console.log('1. Copy the string above.');
    console.log('2. In server/.env, set: TELEGRAM_SESSION_STRING=' + sessionString.substring(0, 20) + '...');
    console.log('3. In your Render Dashboard (moviebuzz-server -> Environment):');
    console.log('   Update TELEGRAM_SESSION_STRING with this new value.');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Login failed:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
})();
