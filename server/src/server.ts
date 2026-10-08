import dotenv from 'dotenv';
dotenv.config();

// Suppress background GramJS MTProto socket update loop timeouts
process.on('unhandledRejection', (reason: any) => {
  if (reason?.message?.includes('TIMEOUT') || reason?.message?.includes('AUTH_KEY') || reason?.message?.includes('DISCONNECT')) {
    return;
  }
  console.warn('[Server] Unhandled Rejection:', reason);
});

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

// Auto-connect MongoDB on incoming serverless / API requests & auto-sync Telegram posts
let lastSyncTimestamp = 0;

app.use(async (req, res, next) => {
  await connectDB();
  const now = Date.now();
  // Trigger Telegram channel/bot sync every 15s when API requests hit the server
  if (now - lastSyncTimestamp > 15000) {
    lastSyncTimestamp = now;
    try {
      const client = storageService.getTelegramClient();
      if (client) {
        client.syncChannelPosts().catch(() => {});
      }
    } catch {
      // Ignore background sync error
    }
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
    const server = app.listen(PORT, async () => {
      console.log(`=======================================================`);
      console.log(` 🎬 CineStream Server running on http://localhost:${PORT}`);
      console.log(` 🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);

      try {
        const client = storageService.getTelegramClient();
        if (client) {
          const count = await client.syncChannelPosts();
          console.log(`[Server] Initial channel sync completed: ${count} posts loaded into website database!`);
        }
      } catch (err) {
        console.warn('[Server] Notice during post sync:', err);
      }

      // Continuous automatic background polling every 60 seconds (no manual restart needed!)
      setInterval(async () => {
        try {
          const client = storageService.getTelegramClient();
          if (client) {
            await client.syncChannelPosts();
          }
        } catch {
          // Ignore background sync error
        }
      }, 60000);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server Error] Port ${PORT} is already in use by another process.`);
        console.error(`[Server Error] Please stop the existing process on port ${PORT} or change process.env.PORT.`);
      } else {
        console.error(`[Server Error]`, err);
      }
    });
  }
  startServer();
}

export default app;
