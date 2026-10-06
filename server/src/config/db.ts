import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinestream';
    const conn = await mongoose.connect(connStr);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database] Connection Error:`, error);
    // In dev mode without local MongoDB running, provide clear warning
    console.warn(`[Database] WARNING: Mongoose failed to connect to ${process.env.MONGODB_URI}. API routes requiring DB will return mock memory responses if available.`);
  }
};
