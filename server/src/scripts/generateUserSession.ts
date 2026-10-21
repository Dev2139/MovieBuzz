import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { TelegramClient, Api } from 'telegram';
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
  console.log('================================================================');
  console.log(' 🔑 Telegram User Session Generator for CineStream');
  console.log('================================================================');
  console.log('This will create a permanent MTProto Session String so movies of');
  console.log('any size (GBs) stream instantly with zero bot limits!\n');

  console.log('Choose API Gateway:');
  console.log('  1) Official Telegram Desktop Gateway (Recommended - Instant Code Delivery)');
  console.log(`  2) Custom API Gateway from .env (ID: ${process.env.TELEGRAM_API_ID || '39243219'})`);
  const choice = (await question('\nEnter choice (1 or 2, default is 1): ')).trim();

  let apiId = 2040;
  let apiHash = 'b18441a1ff607e10a989891a5462e627';

  if (choice === '2') {
    apiId = Number(process.env.TELEGRAM_API_ID || 39243219);
    apiHash = process.env.TELEGRAM_API_HASH || '1d2a346250ff0e4861180d9cfff67cb0';
    console.log(`Using custom API Gateway (${apiId})...`);
  } else {
    console.log('Using official Telegram Desktop Gateway for reliable code delivery...');
  }

  let rawPhone = (await question('\n📱 Enter your Telegram Phone Number (e.g. +919876543210): ')).trim();
  let phone = rawPhone.replace(/[\s\-()]/g, '');
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  console.log(`\n⏳ Connecting to Telegram MTProto gateway for ${phone}...`);

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
    deviceModel: 'Telegram Desktop',
    systemVersion: 'Windows 11',
    appVersion: '5.10.3 x64',
    langCode: 'en',
    systemLangCode: 'en',
  });

  await client.connect();

  console.log('📡 Requesting verification code from Telegram...');
  let sendCodeRes: any;
  try {
    sendCodeRes = await client.sendCode(
      {
        apiId,
        apiHash,
      },
      phone
    );
  } catch (err: any) {
    console.error('\n❌ Telegram could not send code:', err.message);
    if (err.message.includes('PHONE_NUMBER_INVALID')) {
      console.error('👉 The phone number is invalid. Make sure to include the country code (e.g. +91 for India).');
    } else if (err.message.includes('FLOOD_WAIT')) {
      console.error('👉 Telegram has temporarily throttled login requests for this number. Please wait a few minutes.');
    } else if (err.message.includes('AUTH_KEY_UNREGISTERED')) {
      console.error('👉 Authorization key error. Please try again.');
    }
    await client.disconnect();
    rl.close();
    process.exit(1);
  }

  const isApp = sendCodeRes?.type?.className === 'auth.SentCodeTypeApp' || !sendCodeRes?.type?.className?.includes('Sms');
  console.log('\n================================================================');
  if (isApp) {
    console.log('📩 CODE SENT TO YOUR TELEGRAM APP!');
    console.log('👉 Open your Telegram app (mobile or desktop). Look at the top of your');
    console.log('   chat list for the official "Telegram" verified service chat.');
  } else {
    console.log(`📩 CODE SENT VIA SMS TO ${phone}!`);
    console.log('👉 Check your SMS text messages on your phone.');
  }
  console.log('================================================================\n');

  const code = (await question('🔑 Enter the 5-digit Login Code: ')).trim();

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: sendCodeRes.phoneCodeHash,
        phoneCode: code,
      })
    );
  } catch (err: any) {
    if (err.message.includes('SESSION_PASSWORD_NEEDED')) {
      console.log('\n🔐 Two-Step Verification is enabled on your Telegram account.');
      const password = (await question('Enter your Two-Step Verification (Cloud) Password: ')).trim();
      await (client as any).signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => password,
          onError: (e: any) => {
            throw e;
          },
        }
      );
    } else {
      console.error('\n❌ Login failed:', err.message);
      await client.disconnect();
      rl.close();
      process.exit(1);
    }
  }

  const me = await client.getMe();
  console.log('\n🎉 SUCCESS! Logged in as:', (me as any).firstName, (me as any).phone ? `(+${(me as any).phone})` : '');
  const sessionString = client.session.save();

  console.log('\n================================================================');
  console.log('YOUR TELEGRAM SESSION STRING:');
  console.log('================================================================\n');
  console.log(`TELEGRAM_SESSION_STRING=${sessionString}\n`);
  console.log('================================================================');

  // Auto-update server/.env if it exists
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    try {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('TELEGRAM_SESSION_STRING=')) {
        envContent = envContent.replace(/TELEGRAM_SESSION_STRING=.*/, `TELEGRAM_SESSION_STRING=${sessionString}`);
      } else {
        envContent += `\nTELEGRAM_SESSION_STRING=${sessionString}\n`;
      }
      if (choice !== '2') {
        envContent = envContent.replace(/TELEGRAM_API_ID=.*/, `TELEGRAM_API_ID=${apiId}`);
        envContent = envContent.replace(/TELEGRAM_API_HASH=.*/, `TELEGRAM_API_HASH=${apiHash}`);
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✅ Automatically updated server/.env with your new session string!');
    } catch {
      console.log('ℹ️ Please copy the line above manually into your server/.env file.');
    }
  }

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nInitialization error:', err.message);
  rl.close();
  process.exit(1);
});
