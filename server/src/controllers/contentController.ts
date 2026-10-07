import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { Media } from '../models/Media';
import { tmdbService } from '../services/tmdb/tmdbService';

export const getContentList = async (req: Request, res: Response) => {
  try {
    const { type, genre, language, year, sort, limit = 20, page = 1, featured } = req.query;

    const query: any = { status: 'published' };

    if (type && (type === 'movie' || type === 'series')) {
      query.type = type;
    }

    if (genre) {
      query.genres = genre;
    }

    if (language) {
      query.languages = language;
    }

    if (year) {
      query.releaseYear = Number(year);
    }

    if (featured === 'true') {
      query.featured = true;
    }

    let sortOptions: any = { createdAt: -1 };
    if (sort === 'popular') {
      sortOptions = { popularity: -1, rating: -1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1 };
    } else if (sort === 'title') {
      sortOptions = { title: 1 };
    } else if (sort === 'latest') {
      sortOptions = { releaseYear: -1, createdAt: -1 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Content.find(query).sort(sortOptions).skip(skip).limit(Number(limit)),
      Content.countDocuments(query),
    ]);

    // Auto-enrich any items asynchronously if they still use placeholder artwork
    for (const item of items) {
      if (!item.posterUrl || item.posterUrl.includes('unsplash')) {
        tmdbService.fetchMetadata(item.title, item.releaseYear, item.type as any).then((meta) => {
          if (meta) {
            Content.findByIdAndUpdate(item._id, {
              posterUrl: meta.posterUrl,
              backdropUrl: meta.backdropUrl,
              rating: meta.rating,
              description: meta.description,
              genres: meta.genres,
              cast: meta.cast,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return res.json({
      items,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    console.warn('getContentList notice:', error.message);
    return res.json({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  }
};

export const getContentBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const item = await Content.findOne({ slug, status: 'published' });

    if (!item) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Increment popularity/views counter silently
    await Content.findByIdAndUpdate(item._id, { $inc: { popularity: 1 } });

    // Fetch available media qualities for movies
    let availableMedia: any[] = [];
    if (item.type === 'movie') {
      availableMedia = await Media.find({ contentId: item._id, status: 'active' });
    }

    return res.json({
      content: item,
      media: availableMedia,
    });
  } catch (error) {
    console.error('getContentBySlug error:', error);
    return res.status(500).json({ message: 'Error fetching content details' });
  }
};

export const getMovies = async (req: Request, res: Response) => {
  req.query.type = 'movie';
  return getContentList(req, res);
};

export const getSeries = async (req: Request, res: Response) => {
  req.query.type = 'series';
  return getContentList(req, res);
};

export const getGenres = async (req: Request, res: Response) => {
  try {
    const genres = await Content.distinct('genres', { status: 'published' });
    return res.json({ genres: genres.sort() });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching genres' });
  }
};
