import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Media } from '../models/Media';

dotenv.config();

async function fixOceans() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BACKEND_URL || 'http://localhost:5000');

  const uriList = [
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream',
    'mongodb://127.0.0.1:27017/cinestream',
  ];

  for (const uri of uriList) {
    try {
      await mongoose.connect(uri);
      const records = await Media.find({
        $or: [
          { streamUrl: { $regex: /oceans/i } },
          { streamUrl: { $regex: /zencdn/i } },
          { streamUrl: { $regex: /commondatastorage/i } },
          { provider: 'mock' },
        ],
      });

      console.log(`Found ${records.length} sample/mock media records in ${uri}`);
      for (const r of records) {
        const realMediaId = r.providerMediaId && !r.providerMediaId.startsWith('mock')
          ? r.providerMediaId
          : '5909161815681539797';

        const newStream = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(realMediaId)}`;
        const newDownload = `${baseUrl}/api/media/download-file/${encodeURIComponent(realMediaId)}`;

        await Media.findByIdAndUpdate(r._id, {
          provider: 'telegram',
          providerMediaId: realMediaId,
          streamUrl: newStream,
          downloadUrl: newDownload,
        });

        console.log(`Updated Media ID ${r._id} -> ${newStream}`);
      }
      await mongoose.disconnect();
    } catch (err: any) {
      console.warn('Notice during DB fix:', err.message);
    }
  }

  console.log('🎉 Fixed all database sample stream URLs!');
}

fixOceans().catch(console.error);
