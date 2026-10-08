import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Content } from '../models/Content';
import { Season } from '../models/Season';
import { Episode } from '../models/Episode';
import { Media } from '../models/Media';
import { TelegramImport } from '../models/TelegramImport';

dotenv.config();

const sampleStreams = {
  mp4_1080p: 'https://vjs.zencdn.net/v/oceans.mp4',
  mp4_720p: 'https://vjs.zencdn.net/v/oceans.mp4',
  mp4_480p: 'https://vjs.zencdn.net/v/oceans.mp4',
};

async function seedDatabase() {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream';
    await mongoose.connect(connStr);
    console.log('[Seed] Connected to MongoDB');

    // Clean existing database
    await User.deleteMany({});
    await Content.deleteMany({});
    await Season.deleteMany({});
    await Episode.deleteMany({});
    await Media.deleteMany({});
    await TelegramImport.deleteMany({});

    console.log('[Seed] Cleaned existing collections');

    // 1. Create Users
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const userPassword = await bcrypt.hash('user123', salt);

    const admin = await User.create({
      name: 'Administrator',
      email: 'admin@cinestream.com',
      password: adminPassword,
      role: 'admin',
    });

    const user = await User.create({
      name: 'Cinephile User',
      email: 'user@cinestream.com',
      password: userPassword,
      role: 'user',
    });

    console.log(`[Seed] Created Admin (${admin.email}) and User (${user.email})`);

    // 2. Create 10 Movies
    const moviesData = [
      {
        title: 'Cyberpunk: Neon Horizon',
        slug: 'cyberpunk-neon-horizon-2026',
        type: 'movie',
        description: 'In a rain-soaked dystopian metropolis, a rogue hacker uncovers an encrypted conspiracy embedded inside synthetic consciousness modules.',
        posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop',
        trailerUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        releaseYear: 2026,
        genres: ['Sci-Fi', 'Action', 'Thriller'],
        languages: ['English', 'Japanese'],
        cast: ['Kaelen Vance', 'Evelyn Reed', 'Marcus Tanaka'],
        director: 'Sora Takahashi',
        rating: 8.8,
        popularity: 4850,
        featured: true,
        status: 'published',
      },
      {
        title: 'The Starlight Protocol',
        slug: 'the-starlight-protocol-2025',
        type: 'movie',
        description: 'A deep space research vessel stranded near a dark singularity must execute a daring jump through unknown quantum dimensions.',
        posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1600&auto=format&fit=crop',
        releaseYear: 2025,
        genres: ['Sci-Fi', 'Adventure'],
        languages: ['English'],
        cast: ['Sarah Jenkins', 'David O’Connor'],
        director: 'Christopher Nolan',
        rating: 9.1,
        popularity: 5120,
        featured: true,
        status: 'published',
      },
      {
        title: 'Shadows over Prague',
        slug: 'shadows-over-prague-2026',
        type: 'movie',
        description: 'An international espionage agent unravels a secret society operating beneath the cobblestone alleyways of historic Prague.',
        posterUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Thriller', 'Mystery', 'Crime'],
        languages: ['English', 'Czech'],
        cast: ['Julian Mercer', 'Helena Novak'],
        director: 'Luc Besson',
        rating: 8.2,
        popularity: 3200,
        featured: false,
        status: 'published',
      },
      {
        title: 'Apex Warriors: Ascension',
        slug: 'apex-warriors-ascension-2026',
        type: 'movie',
        description: 'Elite gladiators fight for redemption and freedom in an underground arena engineered with holographic biomes.',
        posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Action', 'Fantasy'],
        languages: ['English'],
        cast: ['Jaxson Steele', 'Tora Chen'],
        director: 'Chad Stahelski',
        rating: 8.5,
        popularity: 4100,
        featured: true,
        status: 'published',
      },
      {
        title: 'Echoes of the Deep Sea',
        slug: 'echoes-of-the-deep-sea-2025',
        type: 'movie',
        description: 'A marine biologist explores an uncharted oceanic trench only to awaken an ancient bioluminescent leviathan.',
        posterUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop',
        releaseYear: 2025,
        genres: ['Horror', 'Sci-Fi', 'Adventure'],
        languages: ['English', 'Spanish'],
        cast: ['Elena Rostova', 'Michael Chang'],
        director: 'James Cameron',
        rating: 7.9,
        popularity: 2900,
        featured: false,
        status: 'published',
      },
      {
        title: 'The Grand Illusionist',
        slug: 'the-grand-illusionist-2024',
        type: 'movie',
        description: 'A master magician performs impossible bank heists live on national television, taunting a relentless federal agent.',
        posterUrl: 'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&auto=format&fit=crop',
        releaseYear: 2024,
        genres: ['Crime', 'Mystery', 'Drama'],
        languages: ['English', 'French'],
        cast: ['Arthur Pendelton', 'Clara Dubois'],
        director: 'Denis Villeneuve',
        rating: 8.6,
        popularity: 3800,
        featured: false,
        status: 'published',
      },
      {
        title: 'Solaris Drift',
        slug: 'solaris-drift-2026',
        type: 'movie',
        description: 'Intergalactic racing pilots collide in a zero-gravity tournament held on the rings of Saturn.',
        posterUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Action', 'Sci-Fi'],
        languages: ['English'],
        cast: ['Leo Sterling', 'Maya Lin'],
        director: 'George Miller',
        rating: 8.0,
        popularity: 2400,
        featured: false,
        status: 'published',
      },
      {
        title: 'Chronicles of the Lost Kingdom',
        slug: 'chronicles-of-the-lost-kingdom-2025',
        type: 'movie',
        description: 'A young exile embarks on an epic quest through mystical mountains to reclaim an ancient sun blade.',
        posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop',
        releaseYear: 2025,
        genres: ['Fantasy', 'Adventure'],
        languages: ['English'],
        cast: ['Finneas Thorne', 'Isabella Thorne'],
        director: 'Peter Jackson',
        rating: 8.9,
        popularity: 4900,
        featured: true,
        status: 'published',
      },
      {
        title: 'Midnight in Kyoto',
        slug: 'midnight-in-kyoto-2026',
        type: 'movie',
        description: 'A quiet romance unfolds between a traveling photographer and a traditional tea master under blooming cherry blossoms.',
        posterUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Drama', 'Romance'],
        languages: ['Japanese', 'English'],
        cast: ['Kenji Sato', 'Emilia Rose'],
        director: 'Makoto Shinkai',
        rating: 8.4,
        popularity: 3100,
        featured: false,
        status: 'published',
      },
      {
        title: 'The AI Paradox',
        slug: 'the-ai-paradox-2026',
        type: 'movie',
        description: 'When an autonomous quantum network demands legal personhood, a defense lawyer takes on the trial of the century.',
        posterUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Drama', 'Sci-Fi', 'Thriller'],
        languages: ['English'],
        cast: ['Harrison Wright', 'Victoria Vance'],
        director: 'Alex Garland',
        rating: 8.7,
        popularity: 4300,
        featured: true,
        status: 'published',
      },
    ];

    const insertedMovies = await Content.insertMany(moviesData);
    console.log(`[Seed] Created ${insertedMovies.length} Movies`);

    // Attach quality Media options for each movie
    for (const movie of insertedMovies) {
      await Media.create([
        {
          contentId: movie._id,
          quality: '1080p',
          resolution: '1920x1080',
          fileSize: '1.8 GB',
          duration: 7200,
          mimeType: 'video/mp4',
          provider: 'mock',
          providerMediaId: `mock-movie-1080p-${movie._id}`,
          streamUrl: sampleStreams.mp4_1080p,
          downloadUrl: sampleStreams.mp4_1080p,
          status: 'active',
        },
        {
          contentId: movie._id,
          quality: '720p',
          resolution: '1280x720',
          fileSize: '980 MB',
          duration: 7200,
          mimeType: 'video/mp4',
          provider: 'mock',
          providerMediaId: `mock-movie-720p-${movie._id}`,
          streamUrl: sampleStreams.mp4_720p,
          downloadUrl: sampleStreams.mp4_720p,
          status: 'active',
        },
        {
          contentId: movie._id,
          quality: '480p',
          resolution: '854x480',
          fileSize: '450 MB',
          duration: 7200,
          mimeType: 'video/mp4',
          provider: 'mock',
          providerMediaId: `mock-movie-480p-${movie._id}`,
          streamUrl: sampleStreams.mp4_480p,
          downloadUrl: sampleStreams.mp4_480p,
          status: 'active',
        },
      ]);
    }

    // 3. Create 5 TV Series
    const seriesData = [
      {
        title: 'Quantum Vanguard',
        slug: 'quantum-vanguard-2025',
        type: 'series',
        description: 'A covert team of temporal investigators travels across centuries to prevent paradox events from erasing human history.',
        posterUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600&auto=format&fit=crop',
        releaseYear: 2025,
        genres: ['Sci-Fi', 'Action', 'Mystery'],
        languages: ['English'],
        cast: ['Gabriel Thorne', 'Nadia Al-Mansoor', 'Soren Kjaer'],
        director: 'Jonathan Nolan',
        rating: 9.2,
        popularity: 6400,
        featured: true,
        status: 'published',
      },
      {
        title: 'Valkyrie Protocol',
        slug: 'valkyrie-protocol-2026',
        type: 'series',
        description: 'Cybernetically enhanced operatives protect the high-orbit colonies against terrorist syndicates.',
        posterUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Action', 'Sci-Fi'],
        languages: ['English', 'German'],
        cast: ['Valerie Croft', 'Klaus Weber'],
        director: 'Neill Blomkamp',
        rating: 8.7,
        popularity: 4100,
        featured: true,
        status: 'published',
      },
      {
        title: 'The Iron Syndicate',
        slug: 'the-iron-syndicate-2025',
        type: 'series',
        description: 'In 1920s Chicago, rival mob bosses battle for control of illegal distillation networks using experimental steampunk weaponry.',
        posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop',
        releaseYear: 2025,
        genres: ['Crime', 'Drama', 'History'],
        languages: ['English'],
        cast: ['Tommy Callahan', 'Frankie Salerno'],
        director: 'Martin Scorsese',
        rating: 8.9,
        popularity: 5800,
        featured: false,
        status: 'published',
      },
      {
        title: 'Arcane Realms',
        slug: 'arcane-realms-2026',
        type: 'series',
        description: 'Five elemental academies forge an uneasy truce until an ancient dark spell begins corrupting the magical nexus.',
        posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop',
        releaseYear: 2026,
        genres: ['Fantasy', 'Adventure'],
        languages: ['English'],
        cast: ['Lyra Vance', 'Aelion Starfire'],
        director: 'Guillermo del Toro',
        rating: 9.0,
        popularity: 6100,
        featured: true,
        status: 'published',
      },
      {
        title: 'Neon Underground',
        slug: 'neon-underground-2024',
        type: 'series',
        description: 'Street racers and DJ collective build an underground network resisting totalitarian surveillance in futuristic Neo-Tokyo.',
        posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop',
        backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop',
        releaseYear: 2024,
        genres: ['Music', 'Drama', 'Sci-Fi'],
        languages: ['Japanese', 'English'],
        cast: ['Ryu Tanaka', 'Yuki Sato'],
        director: 'Shinichiro Watanabe',
        rating: 8.4,
        popularity: 3500,
        featured: false,
        status: 'published',
      },
    ];

    const insertedSeries = await Content.insertMany(seriesData);
    console.log(`[Seed] Created ${insertedSeries.length} TV Series`);

    // 4. Create Seasons & Episodes for each series
    let totalEpisodesCreated = 0;
    for (const seriesItem of insertedSeries) {
      for (let sNum = 1; sNum <= 2; sNum++) {
        const season = await Season.create({
          seriesId: seriesItem._id,
          seasonNumber: sNum,
          title: `Season ${sNum}`,
          description: `Season ${sNum} of ${seriesItem.title} featuring intense storylines and new character developments.`,
          posterUrl: seriesItem.posterUrl,
          releaseYear: seriesItem.releaseYear + (sNum - 1),
        });

        // Create 3 episodes per season (Total 30 episodes total)
        for (let eNum = 1; eNum <= 3; eNum++) {
          const episode = await Episode.create({
            seriesId: seriesItem._id,
            seasonId: season._id,
            episodeNumber: eNum,
            title: `Episode ${eNum}: ${sNum === 1 ? 'The Awakening' : 'Reckoning'} Part ${eNum}`,
            description: `In this gripping chapter of ${seriesItem.title}, tensions reach a boiling point as hidden truths are revealed.`,
            thumbnailUrl: seriesItem.backdropUrl,
            duration: 2500 + eNum * 120,
            rating: 8.5,
          });
          totalEpisodesCreated++;

          // Attach media qualities for each episode
          await Media.create([
            {
              episodeId: episode._id,
              quality: '1080p',
              resolution: '1920x1080',
              fileSize: '1.2 GB',
              duration: episode.duration,
              mimeType: 'video/mp4',
              provider: 'mock',
              providerMediaId: `mock-ep-1080p-${episode._id}`,
              streamUrl: sampleStreams.mp4_1080p,
              downloadUrl: sampleStreams.mp4_1080p,
              status: 'active',
            },
            {
              episodeId: episode._id,
              quality: '720p',
              resolution: '1280x720',
              fileSize: '650 MB',
              duration: episode.duration,
              mimeType: 'video/mp4',
              provider: 'mock',
              providerMediaId: `mock-ep-720p-${episode._id}`,
              streamUrl: sampleStreams.mp4_720p,
              downloadUrl: sampleStreams.mp4_720p,
              status: 'active',
            },
          ]);
        }
      }
    }

    console.log(`[Seed] Created Seasons and ${totalEpisodesCreated} Episodes with Media streams`);

    // 5. Seed Telegram Imports queue (Pending Posts for Admin Telegram Import Dashboard testing)
    await TelegramImport.create([
      {
        channelId: '@AuthorizedCinemaChannel',
        messageId: 'tg_msg_1001',
        mediaId: 'tg_media_1001',
        originalCaption: 'Starlight Sentinel (2026) 1080p Dual Audio English Sci-Fi Action WEBRip',
        detectedTitle: 'Starlight Sentinel',
        detectedYear: 2026,
        detectedQuality: '1080p',
        detectedLanguage: 'Dual Audio (Eng/Multi)',
        status: 'PENDING',
      },
      {
        channelId: '@AuthorizedCinemaChannel',
        messageId: 'tg_msg_1002',
        mediaId: 'tg_media_1002',
        originalCaption: 'Cyberpunk Vanguard S02E05 720p English WEBDL x264',
        detectedTitle: 'Cyberpunk Vanguard',
        detectedSeason: 2,
        detectedEpisode: 5,
        detectedQuality: '720p',
        detectedLanguage: 'English',
        status: 'PENDING',
      },
      {
        channelId: '@AuthorizedCinemaChannel',
        messageId: 'tg_msg_1003',
        mediaId: 'tg_media_1003',
        originalCaption: 'The Lost Citadel 4K UHD 2160p HDR English Fantasy',
        detectedTitle: 'The Lost Citadel',
        detectedYear: 2026,
        detectedQuality: '4K',
        detectedLanguage: 'English',
        status: 'PENDING',
      },
    ]);

    console.log('[Seed] Created sample Telegram Import queue items');
    console.log('[Seed] Seed completed successfully! 🎉');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
