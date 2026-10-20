import dotenv from 'dotenv';
dotenv.config();

// Cloudflare edge stream worker proxy enabled
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

import authRoutes from './routes/authRoutes';
import contentRoutes from './routes/contentRoutes';
import seriesRoutes from './routes/seriesRoutes';
import mediaRoutes from './routes/mediaRoutes';
import searchRoutes from './routes/searchRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import requestRoutes from './routes/requestRoutes';
import notificationRoutes from './routes/notificationRoutes';
import streamingRoutes from './routes/streamingRoutes';
import recommendationRoutes from './routes/recommendationRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Dynamic CORS configuration for local, Netlify, Vercel & custom frontends
const rawClientUrls = [
  process.env.CLIENT_URL,
  'https://cinestream.devdhar.in',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
].filter(Boolean) as string[];

const allowedOrigins = new Set(
  rawClientUrls.flatMap((u) => {
    try {
      const parsed = new URL(u);
      return [parsed.origin.toLowerCase(), u.replace(/\/+$/, '').toLowerCase()];
    } catch {
      return [u.replace(/\/+$/, '').toLowerCase()];
    }
  })
);

const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return true;
  const clean = origin.replace(/\/+$/, '').toLowerCase();
  if (allowedOrigins.has(clean)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host.endsWith('.netlify.app') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.devdhar.in') ||
      host === 'devdhar.in' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = not a browser cross-origin call (curl, server-to-
      // server, same-origin). Always fine.
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Fallback rewrite middleware: if a frontend client requests without `/api` prefix
// (e.g. baseURL set without `/api`), automatically route it to the proper `/api` endpoint.
app.use((req, res, next) => {
  if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/streaming') ||
      req.url.startsWith('/content') ||
      req.url.startsWith('/series') ||
      req.url.startsWith('/movies') ||
      req.url.startsWith('/media') ||
      req.url.startsWith('/auth') ||
      req.url.startsWith('/users') ||
      req.url.startsWith('/requests') ||
      req.url.startsWith('/notifications') ||
      req.url.startsWith('/recommendations') ||
      req.url.startsWith('/admin') ||
      req.url.startsWith('/genres') ||
      req.url.startsWith('/search'))
  ) {
    req.url = '/api' + req.url;
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', contentRoutes);
app.use('/api', seriesRoutes);
app.use('/api', mediaRoutes);
app.use('/api', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Root & Health check endpoints
app.get(['/', '/api', '/api/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'CineStream Backend API',
    message: '🎬 CineStream API is active and running (CineStream Edge Streaming Engine)',
    timestamp: new Date().toISOString(),
    streaming: {
      provider: 'CineStream Edge',
      status: 'active',
    },
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

// Standalone local server listener (skipped automatically on Vercel)
if (!process.env.VERCEL) {
  async function startServer() {
    await connectDB();
    const server = app.listen(PORT, async () => {
      console.log(`=======================================================`);
      console.log(` 🎬 CineStream Server running on http://localhost:${PORT}`);
      console.log(` 🚀 Streaming Engine: CineStream Edge & Telegram Cloudflare`);
      console.log(` 🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);

      // Periodic auto-sync for Telegram channel posts (runs every 60s)
      setInterval(async () => {
        try {
          const { storageService } = await import('./services/telegram/telegramService');
          const tgClient = storageService.getTelegramClient();
          if (tgClient && tgClient.isConfigured()) {
            await tgClient.syncChannelPosts().catch(() => {});
          }
        } catch {}
      }, 60 * 1000);
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
