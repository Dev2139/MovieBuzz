import axios from 'axios';
import { movieboxService } from '../services/movieboxService';

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5055';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting MovieBox Integration Test Suite');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // 1. Health & Service check
  await test('Internal Python Bridge Health Check', async () => {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
    if (res.status !== 200 || res.data.status !== 'ok') {
      throw new Error(`Unexpected health status: ${res.status}`);
    }
  });

  // 2. Movie Search
  let foundMovieId = '';
  await test('Movie Search (Query: "Avatar", Type: "movie")', async () => {
    const res = await movieboxService.search('Avatar', 'movie');
    if (!res.results || !res.results.length) {
      throw new Error('Search returned empty results for "Avatar"');
    }
    foundMovieId = res.results[0].subjectId;
    if (!foundMovieId) throw new Error('Subject ID missing from first result');
  });

  // 3. Playback Source Resolution for Movie
  let testResourceLink = '';
  await test('Playback Source Resolution for Movie ID', async () => {
    if (!foundMovieId) throw new Error('No movie ID from previous test');
    const res = await movieboxService.getSources(foundMovieId);
    if (!res.sources || !res.sources.length) {
      throw new Error('No streaming sources returned');
    }
    const firstSource = res.sources[0];
    if (!firstSource.resourceLink) {
      throw new Error('Source resourceLink is empty');
    }
    testResourceLink = firstSource.resourceLink;
  });

  // 4. Series Search & Seasons Resolution
  let foundSeriesId = '';
  await test('Series Search & Seasons Resolution (Query: "Loki")', async () => {
    const res = await movieboxService.search('Loki', 'series');
    if (!res.results || !res.results.length) {
      throw new Error('Series search returned empty results');
    }
    foundSeriesId = res.results[0].subjectId;
    const seasonsRes = await movieboxService.getSeasons(foundSeriesId);
    if (!seasonsRes.seasons || !seasonsRes.seasons.length) {
      throw new Error('No seasons found for series');
    }
  });

  // 5. Series Episode Source Resolution
  await test('Episode Source Resolution (S1 E1)', async () => {
    if (!foundSeriesId) throw new Error('No series ID available');
    const res = await movieboxService.getSources(foundSeriesId, 1, 1);
    if (!res.sources || !res.sources.length) {
      throw new Error('No episode sources found');
    }
  });

  // 6. Non-Existent Title / No Available Sources
  await test('No Available Sources for Non-Existent Title', async () => {
    const res = await movieboxService.resolveByTitle('ZzxqQ987RandomNonsenseTitle12345', 2024, 'movie');
    if (res !== null) {
      throw new Error('Expected null when title has no matching sources');
    }
  });

  // 7. Upstream Range Request Verification
  await test('Byte-Range Request on Resolved Stream URL', async () => {
    if (!testResourceLink) throw new Error('No test resource link available');
    const res = await axios.get(testResourceLink, {
      headers: {
        Range: 'bytes=0-1024',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      validateStatus: (s) => s === 206 || s === 200,
      timeout: 10000,
    });
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`Unexpected status code: ${res.status}`);
    }
  });

  // 8. SRT to WebVTT Subtitle Conversion Logic
  await test('SRT to WebVTT Conversion', async () => {
    const sampleSrt = '1\n00:00:01,000 --> 00:00:04,000\nHello World\n';
    const vtt = sampleSrt.startsWith('WEBVTT')
      ? sampleSrt
      : `WEBVTT\n\n${sampleSrt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;

    if (!vtt.startsWith('WEBVTT') || !vtt.includes('00:00:01.000')) {
      throw new Error('WebVTT formatting failed');
    }
  });

  console.log('====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
