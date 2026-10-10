import { Request, Response } from 'express';
import { ContentRequest } from '../models/ContentRequest';

/**
 * Public/User endpoint to submit a movie or series request
 */
export const createContentRequest = async (req: Request, res: Response) => {
  try {
    const { title, type = 'movie', releaseYear, notes, userName, userEmail } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const authUser = (req as any).user;

    const newRequest = new ContentRequest({
      title: title.trim(),
      type: type === 'series' ? 'series' : 'movie',
      releaseYear: releaseYear ? Number(releaseYear) : undefined,
      notes: notes ? String(notes).trim() : undefined,
      requestedBy: authUser?._id,
      userName: authUser?.name || userName?.trim() || 'Anonymous User',
      userEmail: authUser?.email || userEmail?.trim() || '',
      status: 'pending',
    });

    await newRequest.save();

    return res.status(201).json({
      message: 'Request submitted successfully! Our team will add this title soon.',
      request: newRequest,
    });
  } catch (error: any) {
    console.error('createContentRequest error:', error);
    return res.status(500).json({ message: 'Failed to submit request' });
  }
};

/**
 * Admin endpoint: list all user requests with filters and stats
 */
export const getAdminRequests = async (req: Request, res: Response) => {
  try {
    const { status, type, search } = req.query;

    const query: any = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const [requests, total, pendingCount, fulfilledCount, rejectedCount] = await Promise.all([
      ContentRequest.find(query).sort({ createdAt: -1 }),
      ContentRequest.countDocuments(query),
      ContentRequest.countDocuments({ status: 'pending' }),
      ContentRequest.countDocuments({ status: 'fulfilled' }),
      ContentRequest.countDocuments({ status: 'rejected' }),
    ]);

    return res.json({
      requests,
      total,
      counts: {
        pending: pendingCount,
        fulfilled: fulfilledCount,
        rejected: rejectedCount,
      },
    });
  } catch (error: any) {
    console.error('getAdminRequests error:', error);
    return res.status(500).json({ message: 'Failed to fetch content requests' });
  }
};

/**
 * Admin endpoint: update status (pending, fulfilled, rejected) or admin notes
 */
export const updateRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const updateFields: any = {};
    if (status && ['pending', 'fulfilled', 'rejected'].includes(status)) {
      updateFields.status = status;
    }
    if (adminNotes !== undefined) {
      updateFields.adminNotes = adminNotes;
    }

    const request = await ContentRequest.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json({
      message: `Request marked as ${request.status}`,
      request,
    });
  } catch (error: any) {
    console.error('updateRequestStatus error:', error);
    return res.status(500).json({ message: 'Failed to update request' });
  }
};

/**
 * Admin endpoint: delete request
 */
export const deleteRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ContentRequest.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json({ message: 'Request deleted successfully' });
  } catch (error: any) {
    console.error('deleteRequest error:', error);
    return res.status(500).json({ message: 'Failed to delete request' });
  }
};
