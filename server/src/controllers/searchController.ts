import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { Episode } from '../models/Episode';

export const searchContent = async (req: Request, res: Response) => {
  try {
    const query = req.query.q ? String(req.query.q).trim() : '';

    if (!query) {
      return res.json({ movies: [], series: [], episodes: [] });
    }

    const regex = new RegExp(query, 'i');

    const [movies, series, episodes] = await Promise.all([
      Content.find({
        type: 'movie',
        status: 'published',
        $or: [
          { title: regex },
          { description: regex },
          { cast: regex },
          { director: regex },
          { genres: regex },
          { languages: regex },
        ],
      })
        .limit(10)
        .sort({ popularity: -1 }),

      Content.find({
        type: 'series',
        status: 'published',
        $or: [
          { title: regex },
          { description: regex },
          { cast: regex },
          { director: regex },
          { genres: regex },
          { languages: regex },
        ],
      })
        .limit(10)
        .sort({ popularity: -1 }),

      Episode.find({
        $or: [{ title: regex }, { description: regex }],
      })
        .limit(10)
        .populate('seriesId')
        .populate('seasonId'),
    ]);

    return res.json({
      movies,
      series,
      episodes,
      query,
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ message: 'Error performing search' });
  }
};
