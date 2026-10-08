import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Season } from '../models/Season';
import { Episode } from '../models/Episode';
import { Media } from '../models/Media';
import { Content } from '../models/Content';

export const getSeriesSeasons = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const seasons = await Season.find({ seriesId }).sort({ seasonNumber: 1 });
    return res.json({ seasons });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching seasons' });
  }
};

export const getSeasonEpisodes = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const episodes = await Episode.find({ seasonId }).sort({ episodeNumber: 1 });
    return res.json({ episodes });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching episodes' });
  }
};

export const getEpisodeById = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const episode = await Episode.findById(episodeId).populate('seriesId').populate('seasonId');

    if (!episode) {
      return res.status(404).json({ message: 'Episode not found' });
    }

    const availableMedia = await Media.find({ episodeId: episode._id, status: 'active' });

    // Fetch sibling episodes in the same season for easy previous/next navigation
    const siblingEpisodes = await Episode.find({ seasonId: episode.seasonId })
      .select('_id episodeNumber title duration thumbnailUrl')
      .sort({ episodeNumber: 1 });

    return res.json({
      episode,
      media: availableMedia,
      playlist: siblingEpisodes,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching episode details' });
  }
};

export const getEpisodeByNumber = async (req: Request, res: Response) => {
  try {
    const { seriesSlug, seasonNumber, episodeNumber } = req.params;
    const sNum = Number(seasonNumber) || 1;
    const epNum = Number(episodeNumber) || 1;

    // 1. Intelligent Series Resolution by slug, id, or clean title regex
    let series = await Content.findOne({ slug: seriesSlug });
    if (!series && mongoose.Types.ObjectId.isValid(seriesSlug)) {
      series = await Content.findById(seriesSlug);
    }
    if (!series) {
      const cleanTitle = seriesSlug.replace(/-\d{4}$/, '').replace(/-/g, ' ');
      series = await Content.findOne({
        title: new RegExp(`^${cleanTitle.replace(/[^a-z0-9]/gi, '\\$&')}$`, 'i'),
      });
    }

    if (!series) {
      return res.status(404).json({ message: `Series "${seriesSlug}" not found` });
    }

    // 2. Intelligent Season Resolution
    let season = await Season.findOne({ seriesId: series._id, seasonNumber: sNum });
    if (!season) {
      season = await Season.findOne({ seriesId: series._id }).sort({ seasonNumber: 1 });
    }
    if (!season) {
      season = await Season.create({
        seriesId: series._id,
        seasonNumber: sNum,
        title: `Season ${sNum}`,
        releaseYear: series.releaseYear || 2026,
      });
    }

    // 3. Intelligent Episode Resolution
    let episode = await Episode.findOne({ seasonId: season._id, episodeNumber: epNum });
    if (!episode) {
      episode = await Episode.findOne({ seriesId: series._id, episodeNumber: epNum });
    }
    if (!episode) {
      episode = await Episode.findOne({ seasonId: season._id }).sort({ episodeNumber: 1 });
    }
    if (!episode) {
      episode = await Episode.create({
        seriesId: series._id,
        seasonId: season._id,
        episodeNumber: epNum,
        title: `Episode ${epNum}`,
        description: series.description,
        thumbnailUrl: series.posterUrl,
        duration: 2700,
      });
    }

    // 4. Media Streams & Playlist Resolution
    let availableMedia = await Media.find({ episodeId: episode._id, status: 'active' });
    if (availableMedia.length === 0) {
      availableMedia = await Media.find({ contentId: series._id, status: 'active' });
    }

    const siblingEpisodes = await Episode.find({ seasonId: season._id })
      .select('_id episodeNumber title duration thumbnailUrl')
      .sort({ episodeNumber: 1 });

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const normalizedMedia = availableMedia.map((m) => {
      const obj = m.toObject ? m.toObject() : { ...m };
      if (obj.provider === 'telegram' && obj.providerMediaId) {
        obj.streamUrl = `${baseUrl}/api/media/proxy-file/${encodeURIComponent(obj.providerMediaId)}`;
      }
      return obj;
    });

    return res.json({
      series,
      season,
      episode,
      media: normalizedMedia,
      playlist: siblingEpisodes,
    });
  } catch (error) {
    console.error('getEpisodeByNumber error:', error);
    return res.status(500).json({ message: 'Error resolving episode details' });
  }
};
