/**
 * Script to generate a fresh Telegram String Session for CineStream.
 * Run with: node generate-session.js
 */
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
require('dotenv').config({ path: '.env' });

const apiId = parseInt(process.env.TELEGRAM_API_ID || '2040', 10);
const apiHash = process.env.TELEGRAM_API_HASH || 'b18441a1ff607e10a989891a5462e627';

(async () => {
  console.log('\n--- Telegram Session String Generator ---');
  console.log('Connecting to Telegram MTProto...');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });

  await client.start({
    phoneNumber: async () => await input.text('Enter your phone number (with country code, e.g. +91...): '),
    password: async () => await input.password('Enter your 2FA password (if enabled, or press enter): '),
    phoneCode: async () => await input.text('Enter the verification code received on Telegram: '),
    onError: (err) => console.error('Error:', err.message),
  });

  console.log('\n✅ Successfully Authenticated!');
  const sessionString = client.session.save();
  console.log('\nYour NEW TELEGRAM_SESSION_STRING:\n');
  console.log(sessionString);
  console.log('\nCopy and paste the above string into server/.env:\nTELEGRAM_SESSION_STRING=' + sessionString + '\n');
  process.exit(0);
})();
