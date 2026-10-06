import { ParsedTelegramMetadata } from './types';

/**
 * Robust Telegram Channel Post Parser
 * Extracts Title, Year, Season, Episode, Quality, Resolution, and Language from post caption text.
 * Examples:
 *  - "Cyberpunk: Neon City (2026) 1080p English Sci-Fi"
 *  - "Starlight Odyssey S02E04 720p WEBRip Dual Audio"
 *  - "The Last Sentinel Season 1 Episode 3 1080p x264"
 */
export function parseTelegramCaption(caption: string): ParsedTelegramMetadata {
  const cleanCaption = caption.replace(/\r?\n|\r/g, ' ').trim();

  // 1. Detect Season & Episode (S01E02, S1 E3, Season 1 Episode 2, S01, E02, etc.)
  let season: number | undefined;
  let episode: number | undefined;

  const sAndERegex = /S(\d{1,2})\s*E(\d{1,2})/i;
  const sAndEMatch = cleanCaption.match(sAndERegex);

  if (sAndEMatch) {
    season = parseInt(sAndEMatch[1], 10);
    episode = parseInt(sAndEMatch[2], 10);
  } else {
    const seasonRegex = /(?:Season|S)\s*(\d{1,2})/i;
    const seasonMatch = cleanCaption.match(seasonRegex);
    if (seasonMatch) season = parseInt(seasonMatch[1], 10);

    const epRegex = /(?:Episode|Ep|E)\s*(\d{1,2})/i;
    const epMatch = cleanCaption.match(epRegex);
    if (epMatch) episode = parseInt(epMatch[1], 10);
  }

  // 2. Detect Quality (1080p, 720p, 480p, 4K, 2160p, WEB-DL, BluRay)
  let quality = '1080p';
  let resolution = '1920x1080';

  if (/4K|2160p|UHD/i.test(cleanCaption)) {
    quality = '4K';
    resolution = '3840x2160';
  } else if (/1080p|FHD/i.test(cleanCaption)) {
    quality = '1080p';
    resolution = '1920x1080';
  } else if (/720p|HD/i.test(cleanCaption)) {
    quality = '720p';
    resolution = '1280x720';
  } else if (/480p|SD/i.test(cleanCaption)) {
    quality = '480p';
    resolution = '854x480';
  }

  // 3. Detect Release Year (e.g. (2026), [2025], 2024)
  let year: number | undefined;
  const yearRegex = /\b(19\d{2}|20\d{2})\b/;
  const yearMatch = cleanCaption.match(yearRegex);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // 4. Detect Language (English, Spanish, Hindi, French, Japanese, Dual Audio)
  let language = 'English';
  if (/Dual Audio/i.test(cleanCaption)) {
    language = 'Dual Audio (Eng/Multi)';
  } else if (/Spanish|Español/i.test(cleanCaption)) {
    language = 'Spanish';
  } else if (/Hindi/i.test(cleanCaption)) {
    language = 'Hindi';
  } else if (/Japanese|Anime/i.test(cleanCaption)) {
    language = 'Japanese';
  } else if (/French|Français/i.test(cleanCaption)) {
    language = 'French';
  }

  // 5. Detect Title (Remove S01E01, year, quality keywords from title)
  let title = cleanCaption;
  // Remove quality tags
  title = title.replace(/\b(1080p|720p|480p|4K|2160p|WEB-DL|WEBRip|BluRay|x264|HEVC|Dual Audio|HDR|AAC)\b/gi, '');
  // Remove Season/Episode tags
  title = title.replace(/S\d{1,2}\s*E\d{1,2}/gi, '');
  title = title.replace(/(?:Season|Season\s*\d{1,2}|Episode\s*\d{1,2})/gi, '');
  // Remove year in brackets/parens
  title = title.replace(/\s*[\(\[]?\b(19\d{2}|20\d{2})\b[\)\]]?\s*/g, ' ');
  // Clean up punctuation and whitespace
  title = title.replace(/[-_.:]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!title) {
    title = 'Untitled Imported Media';
  }

  return {
    title,
    year,
    season,
    episode,
    quality,
    resolution,
    language,
  };
}
