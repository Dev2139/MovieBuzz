import mongoose from 'mongoose';
import { Content, IContent } from '../models/Content';
import { WatchHistory } from '../models/WatchHistory';
import { User } from '../models/User';

export interface GuestRecommendationData {
  historyIds?: string[];
  favoriteIds?: string[];
  watchlistIds?: string[];
  preferredGenres?: string[];
}

export interface RecommendationFeed {
  topPicks: IContent[];
  becauseYouWatched?: {
    basedOn: {
      id: string;
      title: string;
      slug: string;
      posterUrl: string;
      backdropUrl: string;
      type: string;
    };
    items: IContent[];
  };
  genrePicks?: {
    genre: string;
    items: IContent[];
  };
  inspiredByFavorites?: IContent[];
  userInterests: { genre: string; score: number }[];
  isColdStart: boolean;
}

/**
 * Calculates a content-to-content similarity score (0 to 100) between two titles
 */
export function calculateContentSimilarity(source: IContent, target: IContent): number {
  if (source._id.toString() === target._id.toString()) return 0;

  let score = 0;

  // 1. Genre similarity (up to 45 points)
  if (source.genres?.length && target.genres?.length) {
    const sGenres = source.genres.map((g) => g.toLowerCase().trim());
    const tGenres = target.genres.map((g) => g.toLowerCase().trim());

    const intersection = sGenres.filter((g) => tGenres.includes(g));
    const union = Array.from(new Set([...sGenres, ...tGenres]));

    const jaccard = union.length > 0 ? intersection.length / union.length : 0;
    // Exact primary genre match bonus
    const primaryMatch = sGenres[0] && tGenres[0] && sGenres[0] === tGenres[0] ? 10 : 0;

    score += jaccard * 35 + primaryMatch;
  }

  // 2. Director match (up to 15 points)
  if (
    source.director &&
    target.director &&
    source.director.trim().toLowerCase() === target.director.trim().toLowerCase()
  ) {
    score += 15;
  }

  // 3. Cast overlap (up to 20 points)
  if (source.cast?.length && target.cast?.length) {
    const sCast = source.cast.map((c) => c.toLowerCase().trim());
    const tCast = target.cast.map((c) => c.toLowerCase().trim());
    const sharedCast = sCast.filter((c) => tCast.includes(c));

    score += Math.min(20, sharedCast.length * 7);
  }

  // 4. Same Content Type (movie vs series) (up to 8 points)
  if (source.type === target.type) {
    score += 8;
  }

  // 5. Release Year proximity (up to 7 points)
  if (source.releaseYear && target.releaseYear) {
    const diff = Math.abs(source.releaseYear - target.releaseYear);
    if (diff <= 2) score += 7;
    else if (diff <= 5) score += 4;
    else if (diff <= 10) score += 2;
  }

  // 6. Quality prior (rating & popularity) (up to 5 points)
  const ratingScore = target.rating ? (target.rating / 10) * 3 : 1;
  const popScore = target.popularity ? Math.min(2, Math.log10(target.popularity + 1)) : 0;
  score += ratingScore + popScore;

  return score;
}

export class RecommendationService {
  /**
   * Finds content similar to a given content (by ID or Slug)
   */
  async getSimilarContent(slugOrId: string, limit: number = 10): Promise<IContent[]> {
    let sourceContent: IContent | null = null;

    if (mongoose.Types.ObjectId.isValid(slugOrId)) {
      sourceContent = await Content.findById(slugOrId);
    }
    if (!sourceContent) {
      sourceContent = await Content.findOne({ slug: slugOrId, status: 'published' });
    }

    if (!sourceContent) {
      return [];
    }

    // Query candidate published content, favoring similar genres or same type
    const query: any = {
      _id: { $ne: sourceContent._id },
      status: 'published',
    };

    if (sourceContent.genres?.length) {
      query.genres = { $in: sourceContent.genres };
    }

    let candidates = await Content.find(query).limit(100);

    // If not enough candidates matching genres, fall back to any published
    if (candidates.length < limit) {
      const more = await Content.find({
        _id: { $nin: [sourceContent._id, ...candidates.map((c) => c._id)] },
        status: 'published',
      })
        .sort({ rating: -1, popularity: -1 })
        .limit(limit * 2);
      candidates = [...candidates, ...more];
    }

    // Score and rank candidates
    const scored = candidates.map((cand) => ({
      content: cand,
      score: calculateContentSimilarity(sourceContent!, cand),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.content);
  }

  /**
   * Generates comprehensive personalized recommendations according to user's
   * viewing history, favorites, watchlist, and explicit interest preferences.
   */
  async getPersonalizedRecommendations(options: {
    userId?: string;
    guestData?: GuestRecommendationData;
    limit?: number;
  }): Promise<RecommendationFeed> {
    const { userId, guestData, limit = 15 } = options;

    const genreWeights: Record<string, number> = {};
    const directorWeights: Record<string, number> = {};
    const castWeights: Record<string, number> = {};
    const typeWeights = { movie: 0, series: 0 };
    const watchedContentIds = new Set<string>();

    let lastWatchedContent: IContent | null = null;
    let userFavoritesList: IContent[] = [];
    let userWatchlistList: IContent[] = [];
    let explicitGenres: string[] = [];

    // --- 1. Gather data for authenticated user ---
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const [user, historyItems] = await Promise.all([
        User.findById(userId).populate<{ favorites: IContent[] }>('favorites').populate<{ watchlist: IContent[] }>('watchlist'),
        WatchHistory.find({ userId })
          .sort({ lastWatchedAt: -1 })
          .limit(25)
          .populate<{ contentId: IContent }>('contentId'),
      ]);

      if (user) {
        if (user.preferredGenres && user.preferredGenres.length > 0) {
          explicitGenres.push(...user.preferredGenres);
        }
        if (user.favorites && user.favorites.length > 0) {
          userFavoritesList = user.favorites.filter((f) => Boolean(f && f._id));
        }
        if (user.watchlist && user.watchlist.length > 0) {
          userWatchlistList = user.watchlist.filter((w) => Boolean(w && w._id));
        }
      }

      // Process Watch History
      historyItems.forEach((hist, index) => {
        const item = hist.contentId;
        if (!item || !item._id) return;

        watchedContentIds.add(item._id.toString());

        if (!lastWatchedContent) {
          lastWatchedContent = item;
        }

        // Recency decay: recent watches carry higher weight
        const recencyWeight = Math.max(0.3, 1 - index * 0.035);

        // Completion multiplier: completed or watched >60% signals high engagement
        let completionMultiplier = 1.0;
        if (hist.completed) {
          completionMultiplier = 1.5;
        } else if (hist.duration > 0 && hist.progress / hist.duration > 0.6) {
          completionMultiplier = 1.3;
        } else if (hist.progress < 60) {
          completionMultiplier = 0.5; // skipped early
        }

        const effectiveWeight = recencyWeight * completionMultiplier;

        // Add to genres
        if (item.genres?.length) {
          item.genres.forEach((g) => {
            const clean = g.trim();
            genreWeights[clean] = (genreWeights[clean] || 0) + 2.5 * effectiveWeight;
          });
        }

        // Add to directors
        if (item.director) {
          const dir = item.director.trim();
          directorWeights[dir] = (directorWeights[dir] || 0) + 2.0 * effectiveWeight;
        }

        // Add to cast
        if (item.cast?.length) {
          item.cast.slice(0, 4).forEach((c) => {
            const actor = c.trim();
            castWeights[actor] = (castWeights[actor] || 0) + 1.2 * effectiveWeight;
          });
        }

        // Add to type preference
        if (item.type === 'movie' || item.type === 'series') {
          typeWeights[item.type] += effectiveWeight;
        }
      });
    }

    // --- 2. Merge Guest / Anonymous Data (if supplied) ---
    if (guestData) {
      if (guestData.preferredGenres?.length) {
        explicitGenres.push(...guestData.preferredGenres);
      }

      const guestContentIds = [
        ...(guestData.historyIds || []),
        ...(guestData.favoriteIds || []),
        ...(guestData.watchlistIds || []),
      ].filter((id) => mongoose.Types.ObjectId.isValid(id));

      if (guestContentIds.length > 0) {
        const guestContents = await Content.find({ _id: { $in: guestContentIds } });
        const contentMap = new Map(guestContents.map((c) => [c._id.toString(), c]));

        // Process guest history
        if (guestData.historyIds) {
          guestData.historyIds.forEach((id, index) => {
            const item = contentMap.get(id);
            if (!item) return;

            watchedContentIds.add(id);
            if (!lastWatchedContent) {
              lastWatchedContent = item;
            }

            const recencyWeight = Math.max(0.3, 1 - index * 0.04);
            if (item.genres?.length) {
              item.genres.forEach((g) => {
                const clean = g.trim();
                genreWeights[clean] = (genreWeights[clean] || 0) + 2.5 * recencyWeight;
              });
            }
            if (item.director) {
              directorWeights[item.director.trim()] = (directorWeights[item.director.trim()] || 0) + 2.0 * recencyWeight;
            }
            if (item.cast?.length) {
              item.cast.slice(0, 4).forEach((c) => {
                castWeights[c.trim()] = (castWeights[c.trim()] || 0) + 1.2 * recencyWeight;
              });
            }
            if (item.type) typeWeights[item.type] += recencyWeight;
          });
        }

        // Process guest favorites
        if (guestData.favoriteIds) {
          guestData.favoriteIds.forEach((id) => {
            const item = contentMap.get(id);
            if (item) userFavoritesList.push(item);
          });
        }

        // Process guest watchlist
        if (guestData.watchlistIds) {
          guestData.watchlistIds.forEach((id) => {
            const item = contentMap.get(id);
            if (item) userWatchlistList.push(item);
          });
        }
      }
    }

    // --- 3. Factor in User Favorites & Watchlist weights ---
    userFavoritesList.forEach((item) => {
      if (!item) return;
      item.genres?.forEach((g) => {
        const clean = g.trim();
        genreWeights[clean] = (genreWeights[clean] || 0) + 2.2;
      });
      if (item.director) {
        directorWeights[item.director.trim()] = (directorWeights[item.director.trim()] || 0) + 1.8;
      }
      item.cast?.slice(0, 3).forEach((c) => {
        castWeights[c.trim()] = (castWeights[c.trim()] || 0) + 1.0;
      });
    });

    userWatchlistList.forEach((item) => {
      if (!item) return;
      item.genres?.forEach((g) => {
        const clean = g.trim();
        genreWeights[clean] = (genreWeights[clean] || 0) + 1.5;
      });
    });

    // --- 4. Explicit User Interest / Genre Preferences ---
    const distinctExplicitGenres = Array.from(new Set(explicitGenres.map((g) => g.trim()).filter(Boolean)));
    distinctExplicitGenres.forEach((g) => {
      // Strong explicit user preference baseline boost
      genreWeights[g] = (genreWeights[g] || 0) + 4.0;
    });

    // --- 5. Determine Top Interests for user taste breakdown ---
    const sortedInterests = Object.entries(genreWeights)
      .map(([genre, score]) => ({ genre, score: Math.round(score * 10) / 10 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const hasUserSignals =
      watchedContentIds.size > 0 ||
      userFavoritesList.length > 0 ||
      distinctExplicitGenres.length > 0;

    // --- 6. Fetch Candidates from Database ---
    const allPublished = await Content.find({ status: 'published' })
      .sort({ releaseDate: -1, releaseYear: -1, rating: -1, popularity: -1 })
      .limit(200);

    // If cold start (brand new user with zero signals)
    if (!hasUserSignals) {
      const topPicks = allPublished.slice(0, limit);
      return {
        topPicks,
        userInterests: [],
        isColdStart: true,
      };
    }

    // --- 7. Score Each Candidate Against User Interest Profile ---
    const scoredCandidates = allPublished.map((item) => {
      let score = 0;
      const itemId = item._id.toString();

      // Moderate penalty if already in watch history, but don't eliminate if catalogue is small
      if (watchedContentIds.has(itemId)) {
        score -= 25;
      }

      // Match genres against weighted genre vector
      if (item.genres?.length) {
        item.genres.forEach((g) => {
          const clean = g.trim();
          if (genreWeights[clean]) {
            score += genreWeights[clean] * 2.0;
          }
        });
      }

      // Match director
      if (item.director && directorWeights[item.director.trim()]) {
        score += directorWeights[item.director.trim()] * 3.0;
      }

      // Match cast
      if (item.cast?.length) {
        item.cast.forEach((c) => {
          const clean = c.trim();
          if (castWeights[clean]) {
            score += castWeights[clean] * 1.5;
          }
        });
      }

      // Type affinity
      if (item.type && typeWeights[item.type] > 0) {
        score += Math.min(6, typeWeights[item.type]);
      }

      // Content quality (rating & popularity)
      if (item.rating && item.rating > 0) {
        score += (item.rating / 10) * 4;
      }
      if (item.popularity && item.popularity > 0) {
        score += Math.min(3, Math.log10(item.popularity + 1));
      }

      // Freshness bonus for recent titles
      const currentYear = new Date().getFullYear();
      if (item.releaseYear && item.releaseYear >= currentYear - 2) {
        score += 3.5;
      }

      return { item, score };
    });

    // Sort descending by calculated score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Filter out watched items for top picks if we have enough fresh items
    const unwatchedCandidates = scoredCandidates.filter((c) => !watchedContentIds.has(c.item._id.toString()));
    const finalTopPicks = (unwatchedCandidates.length >= limit ? unwatchedCandidates : scoredCandidates)
      .slice(0, limit)
      .map((c) => c.item);

    // --- 8. Build "Because You Watched" Row ---
    let becauseYouWatchedSection: RecommendationFeed['becauseYouWatched'] = undefined;
    if (lastWatchedContent) {
      const source: IContent = lastWatchedContent;
      const similarItems = allPublished
        .filter((c) => c._id.toString() !== source._id.toString() && !watchedContentIds.has(c._id.toString()))
        .map((cand) => ({
          content: cand,
          score: calculateContentSimilarity(source, cand),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((s) => s.content);

      if (similarItems.length > 0) {
        becauseYouWatchedSection = {
          basedOn: {
            id: source._id.toString(),
            title: source.title,
            slug: source.slug,
            posterUrl: source.posterUrl,
            backdropUrl: source.backdropUrl,
            type: source.type,
          },
          items: similarItems,
        };
      }
    }

    // --- 9. Build "Because You Love [Top Genre]" Row ---
    let genrePicksSection: RecommendationFeed['genrePicks'] = undefined;
    if (sortedInterests.length > 0) {
      const topGenre = sortedInterests[0].genre;
      const genreCandidates = allPublished
        .filter(
          (c) =>
            c.genres?.some((g) => g.toLowerCase().trim() === topGenre.toLowerCase().trim()) &&
            !watchedContentIds.has(c._id.toString())
        )
        .slice(0, 10);

      if (genreCandidates.length > 0) {
        genrePicksSection = {
          genre: topGenre,
          items: genreCandidates,
        };
      }
    }

    // --- 10. Build "Inspired by Your Favorites" Row ---
    let inspiredByFavoritesSection: IContent[] | undefined = undefined;
    if (userFavoritesList.length > 0) {
      const favoriteIds = new Set(userFavoritesList.map((f) => f._id.toString()));
      const favGenres = new Set(
        userFavoritesList.flatMap((f) => f.genres || []).map((g) => g.toLowerCase().trim())
      );

      const favMatches = allPublished
        .filter(
          (c) =>
            !favoriteIds.has(c._id.toString()) &&
            !watchedContentIds.has(c._id.toString()) &&
            c.genres?.some((g) => favGenres.has(g.toLowerCase().trim()))
        )
        .slice(0, 10);

      if (favMatches.length > 0) {
        inspiredByFavoritesSection = favMatches;
      }
    }

    return {
      topPicks: finalTopPicks,
      becauseYouWatched: becauseYouWatchedSection,
      genrePicks: genrePicksSection,
      inspiredByFavorites: inspiredByFavoritesSection,
      userInterests: sortedInterests,
      isColdStart: false,
    };
  }

  /**
   * Generates a Taste Profile analysis summarizing user's viewing habits
   */
  async getUserTasteProfile(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }

    const [user, historyItems] = await Promise.all([
      User.findById(userId).populate<{ favorites: IContent[] }>('favorites'),
      WatchHistory.find({ userId }).populate<{ contentId: IContent }>('contentId'),
    ]);

    if (!user) return null;

    const genreCounts: Record<string, number> = {};
    let totalWatchedSeconds = 0;
    let completedTitles = 0;
    let moviesCount = 0;
    let seriesEpisodesCount = 0;

    historyItems.forEach((hist) => {
      totalWatchedSeconds += hist.progress || 0;
      if (hist.completed) completedTitles += 1;

      const item = hist.contentId;
      if (!item) return;

      if (item.type === 'movie') moviesCount++;
      if (item.type === 'series') seriesEpisodesCount++;

      item.genres?.forEach((g) => {
        const clean = g.trim();
        genreCounts[clean] = (genreCounts[clean] || 0) + 1;
      });
    });

    // Also factor in explicit preferences
    user.preferredGenres?.forEach((g) => {
      const clean = g.trim();
      genreCounts[clean] = (genreCounts[clean] || 0) + 2;
    });

    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const totalHours = Math.round((totalWatchedSeconds / 3600) * 10) / 10;

    return {
      totalWatchHours: totalHours,
      completedTitles,
      moviesWatched: moviesCount,
      seriesEpisodesWatched: seriesEpisodesCount,
      topGenres,
      preferredGenres: user.preferredGenres || [],
      favoritesCount: user.favorites?.length || 0,
    };
  }
}

export const recommendationService = new RecommendationService();
