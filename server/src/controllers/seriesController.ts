import { Request, Response } from 'express';
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

    const series = await Content.findOne({ slug: seriesSlug, type: 'series' });
    if (!series) {
      return res.status(404).json({ message: 'Series not found' });
    }

    const season = await Season.findOne({ seriesId: series._id, seasonNumber: Number(seasonNumber) });
    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    const episode = await Episode.findOne({ seasonId: season._id, episodeNumber: Number(episodeNumber) });
    if (!episode) {
      return res.status(404).json({ message: 'Episode not found' });
    }

    const availableMedia = await Media.find({ episodeId: episode._id, status: 'active' });
    const siblingEpisodes = await Episode.find({ seasonId: season._id })
      .select('_id episodeNumber title duration thumbnailUrl')
      .sort({ episodeNumber: 1 });

    return res.json({
      series,
      season,
      episode,
      media: availableMedia,
      playlist: siblingEpisodes,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error resolving episode' });
  }
};
