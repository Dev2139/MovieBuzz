import { Request, Response } from 'express';
import axios from 'axios';
import { storageService } from '../services/telegram/telegramService';
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

    // If streamUrl is a full external URL or proxy stream
    let streamUrl = mediaObj.streamUrl;
    if (mediaObj.provider === 'telegram' && mediaObj.providerMediaId && process.env.TELEGRAM_BOT_TOKEN) {
      streamUrl = `http://localhost:5000/api/media/proxy-file/${mediaObj.providerMediaId}`;
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

    let downloadUrl = mediaObj.downloadUrl;
    if (mediaObj.provider === 'telegram' && mediaObj.providerMediaId && process.env.TELEGRAM_BOT_TOKEN) {
      downloadUrl = `http://localhost:5000/api/media/download-file/${mediaObj.providerMediaId}`;
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

/**
 * Proxy video streaming from Telegram file servers directly into HTML5 Video Player
 * Supports HTTP 206 Partial Content range requests for fast seeking
 */
export const proxyTelegramFileStream = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      // Fallback sample open stream if bot token is not configured
      return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    }

    // 1. Get File path from Telegram API
    const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    if (!fileRes.data || !fileRes.data.ok || !fileRes.data.result.file_path) {
      return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    }

    const filePath = fileRes.data.result.file_path;
    const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 2. Stream chunked video bytes directly to client browser
    const headRes = await axios.head(telegramFileUrl).catch(() => null);
    const range = req.headers.range;

    if (range && headRes) {
      const fileSize = parseInt(String(headRes.headers['content-length'] || '0'), 10);
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const videoStream = await axios.get(telegramFileUrl, {
        headers: { Range: `bytes=${start}-${end}` },
        responseType: 'stream',
      });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });

      return videoStream.data.pipe(res);
    } else {
      const videoStream = await axios.get(telegramFileUrl, { responseType: 'stream' });
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      return videoStream.data.pipe(res);
    }
  } catch (error) {
    console.error('proxyTelegramFileStream error:', error);
    return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  }
};

/**
 * Proxy file attachment download from Telegram
 */
export const downloadTelegramFile = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    }

    const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    if (!fileRes.data || !fileRes.data.ok || !fileRes.data.result.file_path) {
      return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    }

    const filePath = fileRes.data.result.file_path;
    const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    res.setHeader('Content-Disposition', 'attachment; filename="Telegram_Movie.mp4"');
    const stream = await axios.get(telegramFileUrl, { responseType: 'stream' });
    return stream.data.pipe(res);
  } catch (error) {
    return res.redirect('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  }
};
