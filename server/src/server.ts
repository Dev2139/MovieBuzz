import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { connectDB } from './config/db';
import { storageService } from './services/telegram/telegramService';

import authRoutes from './routes/authRoutes';
import contentRoutes from './routes/contentRoutes';
import seriesRoutes from './routes/seriesRoutes';
import mediaRoutes from './routes/mediaRoutes';
import searchRoutes from './routes/searchRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Auto-connect MongoDB on incoming serverless / API requests & auto-sync posts if DB is empty
app.use(async (req, res, next) => {
  await connectDB();
  try {
    const { Content } = await import('./models/Content');
    const count = await Content.countDocuments().catch(() => 1);
    if (count === 0) {
      console.log('[Server] Empty MongoDB detected, auto-syncing Telegram channel posts...');
      const client = storageService.getTelegramClient();
      if (client) {
        await client.syncChannelPosts().catch(() => {});
      }
    }
  } catch {
    // Ignore error
  }
  next();
});

// Dynamic CORS configuration for local, Netlify & Vercel frontends
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.netlify.app') || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Allow cross-origin requests for media streaming
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', contentRoutes);
app.use('/api', seriesRoutes);
app.use('/api', mediaRoutes);
app.use('/api', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Root & Health check endpoints
app.get(['/', '/api', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'CineStream Backend API',
    message: '🎬 CineStream API is active and running',
    timestamp: new Date().toISOString(),
  });
});

// Standalone local server listener (skipped automatically on Vercel)
if (!process.env.VERCEL) {
  async function startServer() {
    await connectDB();
    app.listen(PORT, async () => {
      console.log(`=======================================================`);
      console.log(` 🎬 CineStream Server running on http://localhost:${PORT}`);
      console.log(` 🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);

      try {
        const client = storageService.getTelegramClient();
        if (client) {
          const count = await client.syncChannelPosts();
          console.log(`[Server] Channel sync completed: ${count} posts loaded into website database!`);
        }
      } catch (err) {
        console.warn('[Server] Notice during post sync:', err);
      }
    });
  }
  startServer();
}

export default app;
