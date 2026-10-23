import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { AppUpdate } from '../models/AppUpdate';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

/**
 * GET /api/app-updates/latest
 * Public endpoint to fetch the latest application release information.
 */
export const getLatestAppUpdate = async (_req: Request, res: Response) => {
  try {
    const latest = await AppUpdate.findOne({ isActive: true }).sort({ createdAt: -1 });

    if (!latest) {
      // Default fallback release if no custom updates have been created yet
      return res.json({
        version: '2.2.0',
        versionCode: 22,
        title: 'MovieBuzz v2.2.0 — Cinema Engine & Smooth 120fps',
        changelog: '• Silky smooth 120fps bouncy scrolling across all screens\n• Premium 3D cinema squircle app icon\n• Direct edge acceleration and zero frame drops\n• Modern distraction-free player controls',
        downloadUrl: '/moviebuzz.apk',
        apkSize: '55 MB',
        isMandatory: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    return res.json(latest);
  } catch (error) {
    console.error('getLatestAppUpdate error:', error);
    return res.status(500).json({ message: 'Failed to fetch latest app release' });
  }
};

/**
 * GET /api/admin/app-updates
 * Admin: List all releases and broadcast history.
 */
export const getAdminAppUpdates = async (_req: AuthRequest, res: Response) => {
  try {
    const [updates, totalUsers] = await Promise.all([
      AppUpdate.find().sort({ createdAt: -1 }).limit(50),
      User.countDocuments(),
    ]);

    return res.json({ updates, totalUsers });
  } catch (error) {
    console.error('getAdminAppUpdates error:', error);
    return res.status(500).json({ message: 'Failed to fetch app updates' });
  }
};

/**
 * POST /api/admin/app-updates
 * Admin: Publish a new app version & broadcast in-app notification to all users.
 */
export const createAppUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const {
      version,
      versionCode,
      title,
      changelog,
      downloadUrl = '/moviebuzz.apk',
      apkSize = '55 MB',
      isMandatory = false,
      broadcastNotification = true,
    } = req.body;

    if (!version || !title || !changelog) {
      return res.status(400).json({ message: 'Version, title, and changelog are required.' });
    }

    // Deactivate previous releases if this one is marked active
    await AppUpdate.updateMany({}, { $set: { isActive: false } });

    const newUpdate = new AppUpdate({
      version: String(version).trim(),
      versionCode: Number(versionCode) || 1,
      title: String(title).trim(),
      changelog: String(changelog).trim(),
      downloadUrl: String(downloadUrl).trim() || '/moviebuzz.apk',
      apkSize: String(apkSize).trim() || '55 MB',
      isMandatory: Boolean(isMandatory),
      isActive: true,
      usersNotifiedCount: 0,
    });

    // Broadcast system notification to all registered users
    let notifiedCount = 0;
    if (broadcastNotification) {
      const users = await User.find({}, '_id');
      if (users.length > 0) {
        const notifications = users.map((u) => ({
          userId: u._id,
          type: 'system',
          title: `🚀 Update Available: ${newUpdate.version}`,
          body: `${newUpdate.title}\n${newUpdate.changelog.split('\n')[0] || ''}`,
          link: '/install',
          read: false,
        }));

        await Notification.insertMany(notifications, { ordered: false });
        notifiedCount = users.length;
      }
    }

    newUpdate.usersNotifiedCount = notifiedCount;
    await newUpdate.save();

    return res.status(201).json({
      message: `App update ${newUpdate.version} published successfully! Broadcast sent to ${notifiedCount} users.`,
      update: newUpdate,
      notifiedCount,
    });
  } catch (error: any) {
    console.error('createAppUpdate error:', error);
    return res.status(500).json({ message: error.message || 'Failed to create app update' });
  }
};

/**
 * DELETE /api/admin/app-updates/:id
 * Admin: Delete an update record.
 */
export const deleteAppUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const update = await AppUpdate.findByIdAndDelete(req.params.id);
    if (!update) {
      return res.status(404).json({ message: 'App update record not found.' });
    }
    return res.json({ message: 'Update record removed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete app update' });
  }
};
