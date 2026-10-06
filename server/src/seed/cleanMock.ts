import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Content } from '../models/Content';
import { Media } from '../models/Media';

dotenv.config();

async function cleanupMock() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream');

  const realMedia = await Media.find({ provider: 'telegram', providerMediaId: /^BAAC/ });
  const realContentIds = realMedia.map(m => m.contentId).filter(Boolean);

  const realContents = await Content.find({
    posterUrl: /^http:\/\/localhost:5000\/api\/media\/proxy-file/
  });

  const validIds = [...realContentIds, ...realContents.map(c => c._id)];

  const delContent = await Content.deleteMany({ _id: { $nin: validIds } });
  const delMedia = await Media.deleteMany({ providerMediaId: { $not: /^BAAC/ } });

  console.log('Deleted mock content count:', delContent.deletedCount);
  console.log('Deleted mock media count:', delMedia.deletedCount);

  const remainingContents = await Content.find({});
  const remainingMedia = await Media.find({});
  console.log('\n--- REMAINING MOVIES ON WEBSITE (' + remainingContents.length + ') ---');
  remainingContents.forEach(c => console.log('🎬 Movie Title:', c.title, '| ID:', c._id));
  console.log('\n--- REMAINING MEDIA STREAMS (' + remainingMedia.length + ') ---');
  remainingMedia.forEach(m => console.log('📹 Media ID:', m._id, '| Telegram FileId:', m.providerMediaId));

  await mongoose.disconnect();
}

cleanupMock().catch(console.error);
