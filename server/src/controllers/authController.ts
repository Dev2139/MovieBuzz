import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'cinestream_super_secret_jwt_key_2026';
  return jwt.sign({ id: userId }, secret, { expiresIn: '30d' });
};

const publicUserPayload = (u: any) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isPremium: Boolean(u.isPremium),
  cineCoins: u.cineCoins || 0,
  totalCoinsEarned: u.totalCoinsEarned || 0,
  watchTimeCounter: u.watchTimeCounter || 0,
  coinsExpiryAt: u.coinsExpiryAt || null,
  coinTtlMs: 5 * 60 * 60 * 1000,
  canEarnCoins:
    u.role !== 'admin' &&
    !(u.isPremium && !(u.subscriptionPlan && u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt).getTime() > Date.now())),
  subscriptionPlan: u.subscriptionPlan || null,
  subscriptionStartedAt: u.subscriptionStartedAt || null,
  subscriptionExpiresAt: u.subscriptionExpiresAt || null,
  subscriptionCancelledAt: u.subscriptionCancelledAt || null,
  subscriptionPaidINR: u.subscriptionPaidINR || 0,
  subscriptionLastPaymentAt: u.subscriptionLastPaymentAt || null,
  subscriptionActive: Boolean(
    u.subscriptionPlan &&
    u.subscriptionExpiresAt &&
    new Date(u.subscriptionExpiresAt).getTime() > Date.now()
  ),
  upiId: u.upiId || null,
});

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
    });

    await user.save();

    const token = generateToken(user._id.toString());

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      token,
      user: publicUserPayload(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id.toString());

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      token,
      user: publicUserPayload(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  return res.json({
    user: {
      ...publicUserPayload(req.user),
      favorites: req.user.favorites,
      watchlist: req.user.watchlist,
    },
  });
};
