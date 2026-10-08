import { Request, Response } from 'express';
import axios from 'axios';
import { storageService } from '../services/telegram/telegramService';
import { telegramStreamService } from '../services/telegram/telegramStreamService';
import { Media } from '../models/Media';

export const getMediaWatchStream = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const provider = storageService.getProvider();

    const mediaObj = await Media.findById(mediaId);
    if (!mediaObj) {
      const streamUrl = await provider.getStreamUrl(mediaId);
      return res.json({ streamUrl, mediaId });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    let streamUrl = mediaObj.streamUrl;
    if (mediaObj.provider === 'telegram' && mediaObj.providerMediaId) {
      streamUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(mediaObj.providerMediaId)}`;
    }

    return res.json({
      mediaId: mediaObj._id,
      quality: mediaObj.quality,
      resolution: mediaObj.resolution,
      fileSize: mediaObj.fileSize,
      streamUrl: streamUrl || mediaObj.streamUrl,
    });
  } catch (error) {
    console.error('getMediaWatchStream error:', error);
    return res.status(500).json({ message: 'Error fetching media stream' });
  }
};

export const getMediaDownloadLink = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const provider = storageService.getProvider();

    const mediaObj = await Media.findById(mediaId);
    if (!mediaObj) {
      const downloadUrl = await provider.getDownloadUrl(mediaId);
      return res.json({ downloadUrl, quality: '1080p', fileSize: '1.2 GB' });
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    let downloadUrl = mediaObj.downloadUrl;
    if (mediaObj.provider === 'telegram' && mediaObj.providerMediaId) {
      downloadUrl = `${baseUrl}/api/media/download-file/${encodeURIComponent(mediaObj.providerMediaId)}`;
    }

    return res.json({
      downloadUrl: downloadUrl || mediaObj.downloadUrl,
      quality: mediaObj.quality,
      fileSize: mediaObj.fileSize,
      mimeType: mediaObj.mimeType,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error processing download request' });
  }
};

export const proxyTelegramFileStream = async (req: Request, res: Response) => {
  try {
    const rawFileId = req.params.fileId;
    const fileId = decodeURIComponent(rawFileId);
    const range = req.headers.range;

    // Always advertise Accept-Ranges so browser knows we support seeking
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let activeFileId = fileId;
    let messageId: string | undefined = undefined;

    // Pull associated media doc for real document ID or messageId + stored streamUrl fallback
    const mediaDoc = await Media.findOne({
      $or: [
        { providerMediaId: fileId },
        { _id: fileId },
        { streamUrl: { $regex: encodeURIComponent(fileId) } },
      ],
    }).select('providerMediaId providerMessageId streamUrl').lean().catch(() => null);

    if (mediaDoc) {
      messageId = (mediaDoc as any)?.providerMessageId;
      const docMediaId = (mediaDoc as any)?.providerMediaId;
      if (docMediaId && !docMediaId.startsWith('tg_') && !docMediaId.startsWith('mock_')) {
        activeFileId = docMediaId;
      }
    }

    if (!messageId) {
      const match = fileId.match(/tg_(?:mtproto|media)_(\d+)/);
      if (match) messageId = match[1];
    }

    // Only reject if completely synthetic with no telegram message backing
    if (fileId.startsWith('mock_') || (!messageId && !mediaDoc && fileId.length < 10)) {
      return res.status(404).json({
        message: 'This media has no real stream source. Please re-upload the content with a valid Telegram file.',
      });
    }

    const storedStreamUrl: string | undefined = (mediaDoc as any)?.streamUrl;

    // --- TIER 1: MTProto chunk streaming ---
    const totalSize = (await telegramStreamService.getFileSize(activeFileId, messageId)) || 1500000000;

    let start = 0;
    let reqSize = 512 * 1024;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10) || 0;
      if (parts[1]) {
        const requestedEnd = parseInt(parts[1], 10);
        reqSize = Math.min(requestedEnd - start + 1, 1024 * 1024);
      }
    }

    if (start >= totalSize && totalSize > 0) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      return res.end();
    }

    const chunkSize = 512 * 1024;
    const alignedOffset = Math.floor(start / chunkSize) * chunkSize;

    const rawBuffer = await telegramStreamService.getChunk(activeFileId, alignedOffset, chunkSize, messageId);

    if (rawBuffer && rawBuffer.length > 0) {
      // MTProto succeeded — slice to requested range and return
      const sliceStart = start - alignedOffset;
      const sliceEnd = Math.min(sliceStart + reqSize, rawBuffer.length);
      const buffer = rawBuffer.subarray(sliceStart, sliceEnd);

      if (buffer.length === 0) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        return res.end();
      }

      const end = Math.min(start + buffer.length - 1, totalSize - 1);
      let contentType = 'video/mp4';
      if (rawBuffer[0] === 0x1a && rawBuffer[1] === 0x45 && rawBuffer[2] === 0xdf && rawBuffer[3] === 0xa3) {
        contentType = 'video/webm';
      }

      res.writeHead(range ? 206 : 200, {
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${totalSize}` } : {}),
        'Accept-Ranges': 'bytes',
        'Content-Length': buffer.length,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      return res.end(buffer);
    }

    // --- TIER 2: Telegram Bot API getFile + pipe (works for files <= 20MB) ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && fileId && fileId.length > 10 && !fileId.match(/^\d+$/)) {
      try {
        const fileInfoRes = await axios.get(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
          { timeout: 10000 }
        );
        if (fileInfoRes.data?.ok && fileInfoRes.data?.result?.file_path) {
          const tgUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfoRes.data.result.file_path}`;
          const tgRes = await axios.get(tgUrl, {
            headers: range ? { Range: range } : {},
            responseType: 'stream',
            timeout: 30000,
          });
          res.writeHead(tgRes.status, {
            ...tgRes.headers as any,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          });
          tgRes.data.pipe(res);
          return;
        }
      } catch (botApiErr: any) {
        console.warn('[proxyTelegramFileStream] Bot API Tier-2 notice:', botApiErr.message);
      }
    }

    // --- TIER 3: Pipe stored direct streamUrl if it's a real HTTP URL (not circular) ---
    if (storedStreamUrl && storedStreamUrl.startsWith('http') && !storedStreamUrl.includes('/proxy-file/')) {
      try {
        const directRes = await axios.get(storedStreamUrl, {
          headers: range ? { Range: range } : {},
          responseType: 'stream',
          timeout: 30000,
        });
        res.writeHead(directRes.status, {
          ...directRes.headers as any,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        });
        directRes.data.pipe(res);
        return;
      } catch (directErr: any) {
        console.warn('[proxyTelegramFileStream] Direct URL Tier-3 notice:', directErr.message);
      }
    }

    // All tiers failed — return a proper 503 with Accept-Ranges so browser doesn't hang
    return res.status(503).json({ message: 'Media stream temporarily unavailable. Please try again shortly.' });
  } catch (error: any) {
    console.error('proxyTelegramFileStream error:', error.message);
    return res.status(500).json({ message: 'Telegram stream error' });
  }
};

/**
 * Proxy file attachment download from Telegram MTProto in safe 512KB chunks
 */
export const downloadTelegramFile = async (req: Request, res: Response) => {
  try {
    const rawFileId = req.params.fileId;
    const fileId = decodeURIComponent(rawFileId);

    let activeFileId = fileId;
    let messageId: string | undefined = undefined;

    const mediaDoc = await Media.findOne({
      $or: [
        { providerMediaId: fileId },
        { _id: fileId },
        { downloadUrl: { $regex: encodeURIComponent(fileId) } },
      ],
    }).select('providerMediaId providerMessageId').lean().catch(() => null);

    if (mediaDoc) {
      messageId = (mediaDoc as any)?.providerMessageId;
      const docMediaId = (mediaDoc as any)?.providerMediaId;
      if (docMediaId && !docMediaId.startsWith('tg_') && !docMediaId.startsWith('mock_')) {
        activeFileId = docMediaId;
      }
    }

    if (!messageId) {
      const match = fileId.match(/tg_(?:mtproto|media)_(\d+)/);
      if (match) messageId = match[1];
    }

    const totalSize = (await telegramStreamService.getFileSize(activeFileId, messageId)) || 50 * 1024 * 1024;
    const chunkSize = 512 * 1024;

    res.setHeader('Content-Disposition', `attachment; filename="CineStream_${activeFileId.slice(-8)}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');
    if (totalSize > 0) {
      res.setHeader('Content-Length', totalSize);
    }

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = await telegramStreamService.getChunk(activeFileId, offset, chunkSize, messageId);
      if (!chunk || chunk.length === 0) break;
      res.write(chunk);
    }
    return res.end();
  } catch (error: any) {
    console.error('downloadTelegramFile error:', error.message);
    return res.status(500).json({ message: 'Error downloading media' });
  }
};

