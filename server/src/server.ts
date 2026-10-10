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

import authRoutes from './routes/authRoutes';
import contentRoutes from './routes/contentRoutes';
import seriesRoutes from './routes/seriesRoutes';
import mediaRoutes from './routes/mediaRoutes';
import searchRoutes from './routes/searchRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import requestRoutes from './routes/requestRoutes';
import streamingRoutes from './routes/streamingRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(async (req, res, next) => {
  await connectDB();
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
app.use('/api/requests', requestRoutes);
app.use('/api/streaming', streamingRoutes);

// Root & Health check endpoints
app.get(['/', '/api', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'CineStream Backend API',
    message: '🎬 CineStream API is active and running (MovieBox Direct Streaming Engine)',
    timestamp: new Date().toISOString(),
    streaming: {
      provider: 'MovieBox',
      bridgeUrl: process.env.MOVIEBOX_API_URL || 'http://127.0.0.1:5055',
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
      console.log(` 🚀 Streaming Engine: MovieBox Direct`);
      console.log(` 🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);
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
