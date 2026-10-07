import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { Media } from '../models/Media';
import { tmdbService } from '../services/tmdb/tmdbService';

export const getContentList = async (req: Request, res: Response) => {
  try {
    const { type, genre, language, year, sort, limit = 20, page = 1, featured } = req.query;

    const query: any = { status: { $ne: 'draft' } };

    if (type && (type === 'movie' || type === 'series')) {
      query.type = new RegExp(`^${type}$`, 'i');
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
    await Content.findByIdAndUpdate(item._id, { $inc: { popularity: 1 } }).catch(() => {});

    // Fetch available media qualities for movies
    let availableMedia: any[] = [];
    if (item.type === 'movie') {
      availableMedia = await Media.find({ contentId: item._id, status: 'active' }).catch(() => []);
    }

    return res.json({
      content: item,
      media: availableMedia,
    });
  } catch (error: any) {
    console.warn('getContentBySlug notice:', error.message);
    return res.status(404).json({ message: 'Content not found' });
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
    if (genres && genres.length > 0) {
      return res.json({ genres: genres.filter(Boolean).sort() });
    }
  } catch (error: any) {
    console.warn('getGenres notice:', error.message);
  }

  // Safe fallback default genres list so frontend never receives a 500 error
  return res.json({
    genres: [
      'Action',
      'Adventure',
      'Animation',
      'Comedy',
      'Crime',
      'Drama',
      'Fantasy',
      'Horror',
      'Mystery',
      'Romance',
      'Sci-Fi',
      'Thriller',
    ],
  });
};
