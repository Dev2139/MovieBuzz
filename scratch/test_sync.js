const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
console.log('Bot Token:', botToken ? `${botToken.substring(0, 10)}...` : 'NONE');

async function checkUpdates() {
  try {
    const res = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`);
    console.log('Telegram getUpdates result:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error fetching updates:', err.response?.data || err.message);
  }
}

checkUpdates();
