import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.TMDB_API_KEY || '5dbb265bcf35f217cf70ac66d54fd125';

function cleanTitle(raw: string): string {
  let t = raw.replace(/[\(\[]?\b(19\d{2}|20\d{2})\b[\)\]]?/g, ' ');
  t = t.replace(/\b(1080p|720p|480p|4K|2160p|FHD|HD|SD|WEB-?DL|WEBRip|BluRay|BRRip|PreDVDRip|DVDRip|HDRip|Theatre Print|Print|HQ|CAMRip|x264|x265|HEVC|10Bit|AAC|ESub|MSub|Dual Audio|Multi Audio|Hindi|Malayalam|Tamil|Telugu|Kannada|English)\b/gi, ' ');
  t = t.replace(/\b(S\d{1,2}\s*E\d{1,2}|Season\s*\d+|Episode\s*\d+|Ep\s*\d+)\b/gi, ' ');
  t = t.replace(/#[a-z0-9_]+/gi, ' ');
  t = t.replace(/[:\-_+\/\\|,]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || raw;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to MongoDB');
  const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));
  const items = await Content.find({ tmdbId: { $exists: false } });
  console.log('Items needing tmdbId:', items.length);

  let updated = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any;
    const cTitle = cleanTitle(item.title);
    const isTv = item.type === 'series';
    const endpoint = isTv ? 'search/tv' : 'search/movie';
    const yearParam = item.releaseYear ? (isTv ? '&first_air_date_year=' : '&primary_release_year=') + item.releaseYear : '';

    try {
      let res = await axios.get(`https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(cTitle)}${yearParam}&include_adult=false`).catch(() => null);
      let results = res?.data?.results || [];
      if (results.length === 0) {
        res = await axios.get(`https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(cTitle)}&include_adult=false`).catch(() => null);
        results = res?.data?.results || [];
      }
      if (results.length > 0) {
        results.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
        const top = results[0];
        await Content.findByIdAndUpdate(item._id, { tmdbId: top.id });
        updated++;
        console.log(`[${i + 1}/${items.length}] ${item.title} -> tmdbId: ${top.id}`);
      }
    } catch {}

    if (i % 10 === 0 && i > 0) await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Done! Updated tmdbId for ${updated} items.`);
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
