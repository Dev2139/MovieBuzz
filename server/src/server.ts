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

// Security & Parsing Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CineStream Backend API',
    timestamp: new Date().toISOString(),
  });
});

// Start Server after DB Connection
async function startServer() {
  await connectDB();

  app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(` 🎬 CineStream Server running on http://localhost:${PORT}`);
    console.log(` 🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);

    // Trigger channel post sync AFTER MongoDB is fully connected
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
