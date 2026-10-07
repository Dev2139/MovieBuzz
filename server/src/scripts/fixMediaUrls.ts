import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Media } from '../models/Media';

dotenv.config();

async function fixMediaUrls() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream';
  
  // 1. Connect to default URI
  await mongoose.connect(uri);
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : (process.env.BACKEND_URL || 'http://localhost:5000');

  const mediaList = await Media.find({});
  console.log(`Found ${mediaList.length} media documents in primary DB.`);

  for (const media of mediaList) {
    if (media.provider === 'telegram' || media.providerMediaId?.startsWith('tg_')) {
      const proxyUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(media.providerMediaId)}`;
      const downloadUrl = `${baseUrl}/api/media/download-file/${encodeURIComponent(media.providerMediaId)}`;

      await Media.findByIdAndUpdate(media._id, {
        streamUrl: proxyUrl,
        downloadUrl: downloadUrl,
      });
      console.log(`Updated Media ${media._id} streamUrl -> ${proxyUrl}`);
    }
  }

  await mongoose.disconnect();

  // 2. Connect to test DB if different
  if (uri.includes('/cinestream')) {
    const testUri = uri.replace('/cinestream', '/test');
    console.log('\nConnecting to test DB:', testUri);
    await mongoose.connect(testUri);

    const testMediaList = await Media.find({});
    console.log(`Found ${testMediaList.length} media documents in test DB.`);

    for (const media of testMediaList) {
      if (media.provider === 'telegram' || media.providerMediaId?.startsWith('tg_')) {
        const proxyUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(media.providerMediaId)}`;
        const downloadUrl = `${baseUrl}/api/media/download-file/${encodeURIComponent(media.providerMediaId)}`;

        await Media.findByIdAndUpdate(media._id, {
          streamUrl: proxyUrl,
          downloadUrl: downloadUrl,
        });
        console.log(`Updated Test Media ${media._id} streamUrl -> ${proxyUrl}`);
      }
    }
    await mongoose.disconnect();
  }

  console.log('🎉 Done updating all database stream URLs!');
}

fixMediaUrls().catch(console.error);
