import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Content } from '../models/Content';
import { tmdbService } from '../services/tmdb/tmdbService';

dotenv.config();

async function enrichAllDatabaseContent() {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream';
    await mongoose.connect(connStr);
    console.log('[EnrichScript] Connected to MongoDB');

    const allContent = await Content.find({});
    console.log(`[EnrichScript] Found ${allContent.length} content items to enrich...`);

    let count = 0;
    for (const item of allContent) {
      console.log(`\n[EnrichScript] Enriching "${item.title}" (${item.releaseYear})...`);
      const tmdbMeta = await tmdbService.fetchMetadata(item.title, item.releaseYear, item.type as any);

      if (tmdbMeta) {
        console.log(`  ✓ Found TMDB Match: "${tmdbMeta.title}" (Rating: ${tmdbMeta.rating})`);
        console.log(`    Poster: ${tmdbMeta.posterUrl}`);
        console.log(`    Backdrop: ${tmdbMeta.backdropUrl}`);

        item.title = tmdbMeta.title || item.title;
        item.description = tmdbMeta.description || item.description;
        item.posterUrl = tmdbMeta.posterUrl || item.posterUrl;
        item.backdropUrl = tmdbMeta.backdropUrl || item.backdropUrl;
        item.rating = tmdbMeta.rating || item.rating;
        item.releaseYear = tmdbMeta.releaseYear || item.releaseYear;
        if (tmdbMeta.genres && tmdbMeta.genres.length > 0) item.genres = tmdbMeta.genres;
        if (tmdbMeta.cast && tmdbMeta.cast.length > 0) item.cast = tmdbMeta.cast;
        if (tmdbMeta.languages && tmdbMeta.languages.length > 0) item.languages = tmdbMeta.languages;

        await item.save();
        count++;
      } else {
        console.log(`  ⚠ No TMDB match for "${item.title}"`);
      }
    }

    console.log(`\n========================================`);
    console.log(`🎉 Successfully enriched ${count} / ${allContent.length} movies and series in MongoDB!`);
    console.log(`========================================\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[EnrichScript] Error:', error);
    process.exit(1);
  }
}

enrichAllDatabaseContent();
