import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

/**
 * GET /api/notifications
 * Latest 30 notifications for the signed-in user + unread count.
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('getNotifications error:', error);
    return res.status(500).json({ message: 'Failed to load notifications' });
  }
};

/**
 * POST /api/notifications/:id/read
 * Mark one notification as read.
 */
export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true } }
    );
    return res.json({ message: 'Ok' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notification' });
  }
};

/**
 * POST /api/notifications/read-all
 * Mark every notification as read.
 */
export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    return res.json({ message: 'All notifications marked read' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notifications' });
  }
};

/**
 * POST /api/admin/broadcast-notification
 * Admin broadcast a custom system notification to all users.
 */
export const adminBroadcastNotification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { title, body, link = '/download' } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const users = await User.find({}, '_id');
    if (users.length > 0) {
      const notifications = users.map((u) => ({
        userId: u._id,
        type: 'system',
        title: String(title).trim(),
        body: body ? String(body).trim() : undefined,
        link: String(link).trim(),
        read: false,
      }));

      await Notification.insertMany(notifications, { ordered: false });
    }

    return res.status(201).json({
      message: `Broadcast notification successfully sent to ${users.length} users!`,
      count: users.length,
    });
  } catch (error) {
    console.error('adminBroadcastNotification error:', error);
    return res.status(500).json({ message: 'Failed to broadcast notification' });
  }
};
