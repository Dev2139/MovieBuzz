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
  let firstLine = lines[0] || '';

  // 0. Pre-clean trailing file extension
  firstLine = firstLine.replace(/\.(mkv|mp4|avi|mov|wmv|webm|ts|m4v|flv)$/i, '');
  firstLine = firstLine.replace(/\s+\b(mkv|mp4|avi|mov|wmv|webm|ts)\b$/i, '');

  // Convert dots and underscores in filenames to spaces (e.g. Men.in.Black.3 -> Men in Black 3)
  const normalizedLine = firstLine.replace(/[\._]/g, ' ');

  // 1. Detect Season & Episode (Single or Bulk Range e.g. S01-S04, E01-E08, Eps 1-4, 1 to 8)
  let season: number | undefined;
  let seasonEnd: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;

  const seasonRangeRegex = /(?:Season|S)\s*(\d{1,2})\s*(?:-|to|&)\s*(?:Season|S)?\s*(\d{1,2})/i;
  const seasonRangeMatch = caption.match(seasonRangeRegex);
  if (seasonRangeMatch && parseInt(seasonRangeMatch[2], 10) >= parseInt(seasonRangeMatch[1], 10)) {
    season = parseInt(seasonRangeMatch[1], 10);
    seasonEnd = parseInt(seasonRangeMatch[2], 10);
  }

  const rangeRegex = /(?:S(\d{1,2})\s*)?(?:E|Ep|Episode|Episodes|Eps)?\s*(\d{1,2})\s*(?:-|to)\s*(?:E|Ep|Episode|Episodes|Eps)?\s*(\d{1,2})/i;
  const rangeMatch = caption.match(rangeRegex);

  let sAndEMatch = normalizedLine.match(/\bS(\d{1,2})\s*E(\d{1,2})\b/i);

  if (rangeMatch && parseInt(rangeMatch[3], 10) > parseInt(rangeMatch[2], 10)) {
    if (rangeMatch[1] && !season) season = parseInt(rangeMatch[1], 10);
    episode = parseInt(rangeMatch[2], 10);
    episodeEnd = parseInt(rangeMatch[3], 10);
  } else if (sAndEMatch) {
    if (!season) season = parseInt(sAndEMatch[1], 10);
    episode = parseInt(sAndEMatch[2], 10);
  } else {
    const seasonMatch = caption.match(/(?:Season|S)\s*(\d{1,2})/i);
    if (seasonMatch && !season) season = parseInt(seasonMatch[1], 10);

    const epMatch = caption.match(/(?:Episode|Ep|E)\s*(\d{1,2})/i);
    if (epMatch) episode = parseInt(epMatch[1], 10);
  }

  // Construct structured season-wise episode list
  const seasonsList: Array<{ seasonNumber: number; episodes: number[] }> = [];
  if (season !== undefined || episode !== undefined) {
    const startS = season || 1;
    const endS = Math.max(startS, seasonEnd || startS);
    const startEp = episode || 1;
    const endEp = Math.max(startEp, episodeEnd || startEp);

    const epArray: number[] = [];
    for (let e = startEp; e <= endEp; e++) {
      epArray.push(e);
    }

    for (let s = startS; s <= endS; s++) {
      seasonsList.push({
        seasonNumber: s,
        episodes: [...epArray],
      });
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
  const yearRegex = /(?:[\(\[]\s*)?\b(19\d{2}|20\d{2})\b(?:\s*[\)\]])?/;
  const yearMatch = normalizedLine.match(yearRegex) || caption.match(yearRegex);
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

  // 7. Intelligent Title Extraction (Isolate clean movie name from scene metadata)
  let workingText = normalizedLine;
  let cutoffIndex = -1;

  // Cutoff at year marker if at least 2 characters precede it
  const lineYearMatch = workingText.match(yearRegex);
  if (lineYearMatch && lineYearMatch.index !== undefined && lineYearMatch.index >= 2) {
    cutoffIndex = lineYearMatch.index;
  }

  // Cutoff at season/episode marker if earlier than year
  if (sAndEMatch && sAndEMatch.index !== undefined && sAndEMatch.index >= 2) {
    if (cutoffIndex === -1 || sAndEMatch.index < cutoffIndex) {
      cutoffIndex = sAndEMatch.index;
    }
  }

  // Cutoff at resolution/source tag if earlier than year
  const qualityCutoff = workingText.match(/\b(2160p|1080p|720p|480p|4k|uhd|fhd|bluray|bdrip|brrip|web-?dl|web-?rip|dvdrip|theatre\s*print|predvdrip|camrip|hdcam)\b/i);
  if (qualityCutoff && qualityCutoff.index !== undefined && qualityCutoff.index >= 2) {
    if (cutoffIndex === -1 || qualityCutoff.index < cutoffIndex) {
      cutoffIndex = qualityCutoff.index;
    }
  }

  let title = workingText;
  if (cutoffIndex > 0) {
    title = workingText.slice(0, cutoffIndex);
  }

  // Thorough strip of any remaining brackets and scene tags
  title = title.replace(/\[.*?\]/g, ' ');
  title = title.replace(/\(.*?\)/g, ' ');
  title = title.replace(/\{.*?\}/g, ' ');
  title = title.replace(/\[.*$/g, ' ');
  title = title.replace(/\(.*$/g, ' ');
  title = title.replace(/#[a-z0-9_]+/gi, ' ');
  title = title.replace(/\b(1080p|720p|480p|4k|2160p|uhd|fhd|hd|sd|10bit|8bit|12bit|hdr10\+|hdr10|hdr|dovi|dv|bluray|bdrip|brrip|web-?dl|web-?rip|dvdrip|theatre\s*print|predvdrip|hq|camrip|x264|x265|hevc|avc|h\.264|h\.265|dual\s*audio|multi\s*audio|org\s*audio|org\s*bd|dts-?hd(\s*ma)?|dts|truehd|atmos|ddp5\.1|ddp|dd|ac3|aac|5\.1|7\.1|esub|msub|proper|repack|yts|yify|psa|galaxy|mkv|mp4)\b/gi, ' ');
  title = title.replace(/[\-–—:_|/\\]+$/g, ' ');
  title = title.replace(/^[\-–—:_|/\\]+/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();

  if (!title) {
    title = firstLine.replace(/[\._]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled Content';
  }

  return {
    title,
    year,
    season,
    seasonEnd,
    episode,
    episodeEnd,
    seasonsList,
    quality,
    resolution,
    language,
    cast,
    genres,
  };
}
