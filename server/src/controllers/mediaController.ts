import { Request, Response } from 'express';
import { storageService } from '../services/telegram/telegramService';
import { Media } from '../models/Media';

export const getMediaWatchStream = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const provider = storageService.getProvider();

    const mediaObj = await Media.findById(mediaId);
    if (!mediaObj) {
      // Fallback stream resolution via provider interface
      const streamUrl = await provider.getStreamUrl(mediaId);
      return res.json({ streamUrl, media: null });
    }

    const streamUrl = await provider.getStreamUrl(mediaObj._id.toString());
    return res.json({
      mediaId: mediaObj._id,
      quality: mediaObj.quality,
      resolution: mediaObj.resolution,
      fileSize: mediaObj.fileSize,
      streamUrl: mediaObj.streamUrl || streamUrl,
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

    const downloadUrl = await provider.getDownloadUrl(mediaObj._id.toString());
    return res.json({
      downloadUrl: mediaObj.downloadUrl || downloadUrl,
      quality: mediaObj.quality,
      fileSize: mediaObj.fileSize,
      mimeType: mediaObj.mimeType,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error processing download request' });
  }
};
