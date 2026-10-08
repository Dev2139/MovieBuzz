import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Content } from '../models/Content';
import { Media } from '../models/Media';

dotenv.config();

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const contents = await Content.find({});
  const media = await Media.find({});

  console.log('=== TOTAL CONTENTS IN DB:', contents.length, '===');
  contents.forEach((c) => {
    console.log(`🎬 [${c.type}] Title: "${c.title}" | ID: ${c._id}`);
  });

  console.log('\n=== TOTAL MEDIA IN DB:', media.length, '===');
  media.forEach((m) => {
    console.log(`📹 MediaID: ${m._id} | Provider: ${m.provider} | FileId: ${m.providerMediaId} | StreamUrl: ${m.streamUrl}`);
  });

  await mongoose.disconnect();
}

checkDb().catch(console.error);
