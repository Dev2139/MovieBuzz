import { ParsedTelegramMetadata } from './types';

/**
 * Robust Telegram Channel Post Parser
 * Parses single-line and multi-line posts from Telegram channels like JNV Moviebuzz.
 * Examples:
 *  - "Drishyam: The Conclusion (2026)\nTheatre Print\n\nCast: Ajay Devgn, Jaideep Ahlawat\nGenres: Crime, Drama\n#jnvmoviebuzz"
 *  - "Bethlehem Kudumba Unit (2026) 720p HD Dual Audio: Hindi + Malayalam"
 */
export function parseTelegramCaption(caption: string): ParsedTelegramMetadata {
  const lines = caption.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';

  // 1. Detect Season & Episode (Single or Bulk Range e.g. E01-E04, Eps 1-4)
  let season: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;

  const rangeRegex = /(?:S(\d{1,2})\s*)?(?:E|Ep|Episode|Episodes)\s*(\d{1,2})\s*(?:-|to|\b)\s*(?:E|Ep|Episode)?\s*(\d{1,2})/i;
  const rangeMatch = caption.match(rangeRegex);

  if (rangeMatch && parseInt(rangeMatch[3], 10) > parseInt(rangeMatch[2], 10)) {
    if (rangeMatch[1]) season = parseInt(rangeMatch[1], 10);
    episode = parseInt(rangeMatch[2], 10);
    episodeEnd = parseInt(rangeMatch[3], 10);
  } else {
    const sAndERegex = /S(\d{1,2})\s*E(\d{1,2})/i;
    const sAndEMatch = caption.match(sAndERegex);

    if (sAndEMatch) {
      season = parseInt(sAndEMatch[1], 10);
      episode = parseInt(sAndEMatch[2], 10);
    } else {
      const seasonMatch = caption.match(/(?:Season|S)\s*(\d{1,2})/i);
      if (seasonMatch) season = parseInt(seasonMatch[1], 10);

      const epMatch = caption.match(/(?:Episode|Ep|E)\s*(\d{1,2})/i);
      if (epMatch) episode = parseInt(epMatch[1], 10);
    }
  }

  // 2. Quality
  let quality = '1080p';
  let resolution = '1920x1080';

  if (/4K|2160p|UHD/i.test(caption)) {
    quality = '4K';
    resolution = '3840x2160';
  } else if (/1080p|FHD/i.test(caption)) {
    quality = '1080p';
    resolution = '1920x1080';
  } else if (/720p|HD/i.test(caption)) {
    quality = '720p';
    resolution = '1280x720';
  } else if (/480p|SD/i.test(caption)) {
    quality = '480p';
    resolution = '854x480';
  }

  // 3. Release Year
  let year: number | undefined;
  const yearMatch = caption.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // 4. Languages
  let language = 'English';
  if (/Dual Audio/i.test(caption)) {
    const langsMatch = caption.match(/Dual Audio:?\s*([^\n]+)/i);
    language = langsMatch ? `Dual Audio (${langsMatch[1].trim()})` : 'Dual Audio (Hindi/Malayalam)';
  } else if (/Hindi/i.test(caption)) {
    language = 'Hindi';
  } else if (/Malayalam/i.test(caption)) {
    language = 'Malayalam';
  } else if (/Spanish/i.test(caption)) {
    language = 'Spanish';
  } else if (/Japanese/i.test(caption)) {
    language = 'Japanese';
  }

  // 5. Cast
  let cast: string[] | undefined;
  const castMatch = caption.match(/Cast:\s*([^\n]+)/i);
  if (castMatch) {
    cast = castMatch[1].split(',').map((c) => c.trim()).filter(Boolean);
  }

  // 6. Genres
  let genres: string[] | undefined;
  const genresMatch = caption.match(/Genres:\s*([^\n]+)/i);
  if (genresMatch) {
    genres = genresMatch[1].split(',').map((g) => g.trim()).filter(Boolean);
  }

  // 7. Title Extraction from first line
  let title = firstLine;
  // Strip year
  title = title.replace(/\s*[\(\[]?\b(19\d{2}|20\d{2})\b[\)\]]?\s*/g, ' ');
  // Strip quality tags
  title = title.replace(/\b(1080p|720p|480p|4K|2160p|HD|FHD|WEB-DL|WEBRip|BluRay|Dual Audio)\b/gi, '');
  // Strip hashtags & unwanted text
  title = title.replace(/#[a-z0-9_]+/gi, '');
  title = title.replace(/\b(Theatre Print|PreDVDRip|HQ|x264|HEVC)\b/gi, '');
  title = title.replace(/\s+/g, ' ').trim();

  if (!title) {
    title = 'Untitled Movie';
  }

  return {
    title,
    year,
    season,
    episode,
    episodeEnd,
    quality,
    resolution,
    language,
    cast,
    genres,
  };
}
