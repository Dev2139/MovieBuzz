import { subtitleService } from '../services/subtitleService';

async function runSubtitleTests() {
  console.log('Testing Subtitle Service...');

  // 1. Movie subtitle lookup (Avatar)
  console.log('\n[1] Testing Movie Subtitles (tt0499549)...');
  const movieSubs = await subtitleService.getSubtitles({
    title: 'Avatar',
    imdbId: 'tt0499549',
    type: 'movie',
    baseUrl: 'http://localhost:5000',
  });
  console.log(`Found ${movieSubs.length} subtitles for Avatar.`);
  if (movieSubs.length === 0) {
    throw new Error('Expected at least 1 subtitle for Avatar');
  }

  // 2. Series subtitle lookup (Breaking Bad S1 E1)
  console.log('\n[2] Testing Series Subtitles (Breaking Bad S1 E1)...');
  const seriesSubs = await subtitleService.getSubtitles({
    title: 'Breaking Bad',
    type: 'series',
    season: 1,
    episode: 1,
    baseUrl: 'http://localhost:5000',
  });
  console.log(`Found ${seriesSubs.length} subtitles for Breaking Bad.`);
  if (seriesSubs.length === 0) {
    throw new Error('Expected at least 1 subtitle for Breaking Bad');
  }

  // 3. Test WebVTT file generation
  console.log('\n[3] Testing WebVTT Conversion...');
  const firstSub = movieSubs.find(s => s.language === 'en') || movieSubs[0];
  const urlObj = new URL(firstSub.src);
  const pageParam = urlObj.searchParams.get('page') || '';
  const vtt = await subtitleService.getSubtitleFile({
    source: 'yify',
    page: pageParam,
  });
  if (!vtt.startsWith('WEBVTT')) {
    throw new Error('Expected WebVTT format');
  }
  console.log(`Successfully generated WebVTT (${vtt.length} characters).`);

  console.log('\n✅ All subtitle tests passed successfully!');
}

runSubtitleTests().catch((err) => {
  console.error('Subtitle test failed:', err);
  process.exit(1);
});
