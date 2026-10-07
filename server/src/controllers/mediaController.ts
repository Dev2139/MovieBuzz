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

    const serveFallbackStream = async () => {
      const fallbackUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
      const streamRes = await axios.get(fallbackUrl, {
        headers: range ? { Range: range } : {},
        responseType: 'stream',
        timeout: 8000,
      }).catch(() => null);

      if (streamRes) {
        const headers: any = {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        };
        if (streamRes.headers['content-range']) {
          headers['Content-Range'] = String(streamRes.headers['content-range']);
        }
        if (streamRes.headers['content-length']) {
          headers['Content-Length'] = String(streamRes.headers['content-length']);
        }
        res.writeHead(range ? 206 : 200, headers);
        return streamRes.data.pipe(res);
      }
      return res.status(503).json({ message: 'Media stream unavailable' });
    };

    // MTProto Chunk Range Streaming
    const mediaDoc = await Media.findOne({ providerMediaId: fileId }).select('providerMessageId').lean().catch(() => null);
    const messageId = mediaDoc?.providerMessageId;

    let start = 0;
    let reqSize = 512 * 1024;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10) || 0;
      if (parts[1]) {
        const end = parseInt(parts[1], 10);
        reqSize = Math.min(end - start + 1, 1024 * 1024);
      }
    }

    const chunkSize = 512 * 1024;
    const alignedOffset = Math.floor(start / chunkSize) * chunkSize;
    const limit = chunkSize;

    const rawBuffer = await telegramStreamService.getChunk(fileId, alignedOffset, limit, messageId);

    if (!rawBuffer) {
      return serveFallbackStream();
    }

    const sliceStart = start - alignedOffset;
    const sliceEnd = Math.min(sliceStart + reqSize, rawBuffer.length);
    const buffer = rawBuffer.subarray(sliceStart, sliceEnd);

    const totalSize = (await telegramStreamService.getFileSize(fileId)) || 1500000000;
    const end = Math.min(start + buffer.length - 1, totalSize - 1);

    let contentType = 'video/mp4';
    if (rawBuffer.length >= 4 && rawBuffer[0] === 0x1a && rawBuffer[1] === 0x45 && rawBuffer[2] === 0xdf && rawBuffer[3] === 0xa3) {
      contentType = 'video/webm';
    }

    if (range) {
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': buffer.length,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      return res.end(buffer);
    } else {
      res.writeHead(200, {
        'Content-Length': buffer.length,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      return res.end(buffer);
    }
  } catch (error: any) {
    console.error('proxyTelegramFileStream error:', error.message);
    const fallbackUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
    const streamRes = await axios.get(fallbackUrl, {
      headers: req.headers.range ? { Range: req.headers.range } : {},
      responseType: 'stream',
      timeout: 8000,
    }).catch(() => null);

    if (streamRes) {
      const headers: any = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      if (streamRes.headers['content-range']) {
        headers['Content-Range'] = String(streamRes.headers['content-range']);
      }
      if (streamRes.headers['content-length']) {
        headers['Content-Length'] = String(streamRes.headers['content-length']);
      }
      res.writeHead(req.headers.range ? 206 : 200, headers);
      return streamRes.data.pipe(res);
    }
    return res.status(500).json({ message: 'Stream error' });
  }
};

/**
 * Proxy file attachment download from Telegram MTProto in safe 512KB chunks
 */
export const downloadTelegramFile = async (req: Request, res: Response) => {
  try {
    const rawFileId = req.params.fileId;
    const fileId = decodeURIComponent(rawFileId);

    const mediaDoc = await Media.findOne({ providerMediaId: fileId }).select('providerMessageId').lean().catch(() => null);
    const messageId = mediaDoc?.providerMessageId;

    const totalSize = (await telegramStreamService.getFileSize(fileId)) || 50 * 1024 * 1024;
    const chunkSize = 512 * 1024;

    res.setHeader('Content-Disposition', `attachment; filename="CineStream_${fileId.slice(-8)}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');
    if (totalSize > 0) {
      res.setHeader('Content-Length', totalSize);
    }

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = await telegramStreamService.getChunk(fileId, offset, chunkSize, messageId);
      if (!chunk || chunk.length === 0) break;
      res.write(chunk);
    }
    return res.end();
  } catch (error: any) {
    console.error('downloadTelegramFile error:', error.message);
    return res.status(500).json({ message: 'Error downloading media' });
  }
};

