import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { telegramStreamService } from '../services/telegram/telegramStreamService';

async function fixMtprotoMedia() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const Content = mongoose.connection.collection('contents');
  const Media = mongoose.connection.collection('media');

  const mtprotoMedia = await Media.find({
    providerMediaId: { $regex: '^tg_mtproto_' }
  }).toArray();

  console.log(`Found ${mtprotoMedia.length} media records with tg_mtproto_ IDs`);

  const client = await telegramStreamService.getClient();
  if (!client) {
    console.error('Could not connect MTProto client');
    process.exit(1);
  }

  const channelId = process.env.TELEGRAM_CHANNEL_ID!;
  const peer = await client.getEntity(channelId);

  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : (process.env.BACKEND_URL || 'http://localhost:5000');

  let updatedCount = 0;

  for (const m of mtprotoMedia) {
    const msgIdMatch = m.providerMediaId.match(/^tg_mtproto_(\d+)/);
    const msgId = msgIdMatch ? Number(msgIdMatch[1]) : (m.providerMessageId ? Number(m.providerMessageId) : null);

    if (!msgId) {
      console.log(`Skipping media ${m._id}: no messageId found`);
      continue;
    }

    try {
      const msgs = await client.getMessages(peer, { ids: [msgId] });
      const msg = msgs[0];

      if (msg && msg.media && (msg.media as any).document) {
        const doc = (msg.media as any).document;
        const realDocId = doc.id.toString();
        const docSize = doc.size ? (doc.size.toNumber ? doc.size.toNumber() : Number(doc.size)) : 0;
        
        let fileSizeStr = `${(docSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        if (docSize < 1024 * 1024 * 1024) {
          fileSizeStr = `${(docSize / (1024 * 1024)).toFixed(0)} MB`;
        }

        const streamUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(realDocId)}`;
        const downloadUrl = `${baseUrl}/api/media/download-file/${encodeURIComponent(realDocId)}`;

        await Media.updateOne(
          { _id: m._id },
          {
            $set: {
              providerMediaId: realDocId,
              providerMessageId: String(msgId),
              streamUrl,
              downloadUrl,
              fileSize: fileSizeStr,
              mimeType: doc.mimeType || 'video/mp4',
            }
          }
        );

        const content = await Content.findOne({ _id: m.contentId });
        console.log(`Updated "${content?.title || m.title || msgId}" -> docId: ${realDocId} (${fileSizeStr})`);
        updatedCount++;
      } else {
        console.log(`Msg ${msgId} has no video document attached`);
      }
    } catch (err: any) {
      console.warn(`Error updating msg ${msgId}:`, err.message);
    }
  }

  console.log(`Successfully updated ${updatedCount} media records with real Telegram Document IDs!`);
  await mongoose.disconnect();
  process.exit(0);
}

fixMtprotoMedia().catch(console.error);
