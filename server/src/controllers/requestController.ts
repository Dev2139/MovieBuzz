import { Request, Response } from 'express';
import { ContentRequest, normalizeRequestTitle } from '../models/ContentRequest';
import { Notification } from '../models/Notification';

/**
 * Public/User endpoint to submit a movie or series request.
 * If an identical PENDING request already exists, the submission merges into it
 * as a vote instead of creating a duplicate (community leaderboard).
 */
export const createContentRequest = async (req: Request, res: Response) => {
  try {
    const { title, type = 'movie', releaseYear, notes, userName, userEmail } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const authUser = (req as any).user;
    const normalized = normalizeRequestTitle(title);

    // Merge into an existing pending request for the same title (same type)
    const existing = await ContentRequest.findOne({
      normalizedTitle: normalized,
      status: 'pending',
      type: type === 'series' ? 'series' : 'movie',
    }).sort({ createdAt: -1 });

    if (existing) {
      if (!authUser?._id) {
        return res.status(401).json({
          message: 'Please sign in to support this request — the community is already waiting for it!',
          existingRequestId: existing._id,
        });
      }
      const alreadyVoted = existing.votes.some((v) => String(v) === String(authUser._id));
      const isOriginalRequester = existing.requestedBy && String(existing.requestedBy) === String(authUser._id);
      if (alreadyVoted || isOriginalRequester) {
        return res.status(409).json({
          message: `"${existing.title}" is already requested by you — you're on the list!`,
          existingRequestId: existing._id,
        });
      }
      existing.votes.push(authUser._id);
      await existing.save();

      // Notify the original requester that someone else also wants their title
      if (existing.requestedBy && String(existing.requestedBy) !== String(authUser._id)) {
        await Notification.create({
          userId: existing.requestedBy,
          type: 'request',
          title: `Someone else also wants "${existing.title}" 🙌`,
          body: `${existing.votes.length} people are now waiting for this ${existing.type}. We're more likely to add it soon!`,
          link: '/requests',
        });
      }

      return res.status(200).json({
        message: `"${existing.title}" was already requested — your vote has been added to the leaderboard!`,
        request: existing,
        merged: true,
      });
    }

    const newRequest = new ContentRequest({
      title: title.trim(),
      normalizedTitle: normalized,
      type: type === 'series' ? 'series' : 'movie',
      releaseYear: releaseYear ? Number(releaseYear) : undefined,
      notes: notes ? String(notes).trim() : undefined,
      requestedBy: authUser?._id,
      userName: authUser?.name || userName?.trim() || 'Anonymous User',
      userEmail: authUser?.email || userEmail?.trim() || '',
      votes: authUser?._id ? [authUser._id] : [],
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
 * Public endpoint: community requests leaderboard.
 * Pending requests ranked by number of votes; optional search filter.
 */
export const getRequestLeaderboard = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const type = req.query.type === 'movie' || req.query.type === 'series' ? req.query.type : 'all';

    const query: any = { status: 'pending' };
    if (type !== 'all') query.type = type;
    if (search) query.normalizedTitle = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const requests = await ContentRequest.find(query)
      .sort({ votes: -1, createdAt: -1 })
      .limit(100)
      .select('title type releaseYear votes requestedBy createdAt');

    const payload = requests.map((r) => ({
      _id: r._id,
      title: r.title,
      type: r.type,
      releaseYear: r.releaseYear,
      voteCount: r.votes.length,
      hasVoted: authUser?._id ? r.votes.some((v) => String(v) === String(authUser._id)) : false,
      isMine: authUser?._id ? Boolean(r.requestedBy && String(r.requestedBy) === String(authUser._id)) : false,
      createdAt: r.createdAt,
    }));

    return res.json({ requests: payload });
  } catch (error: any) {
    console.error('getRequestLeaderboard error:', error);
    return res.status(500).json({ message: 'Failed to load leaderboard' });
  }
};

/**
 * Authenticated endpoint: toggle "me too" vote on a pending request.
 */
export const voteRequest = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser?._id) return res.status(401).json({ message: 'Please sign in to vote' });

    const request = await ContentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request is no longer accepting votes' });
    }

    const idx = request.votes.findIndex((v) => String(v) === String(authUser._id));
    let voted: boolean;
    if (idx >= 0) {
      // Don't let the original requester remove their own request via unvote
      if (request.requestedBy && String(request.requestedBy) === String(authUser._id)) {
        return res.status(400).json({ message: 'You cannot unvote your own request' });
      }
      request.votes.splice(idx, 1);
      voted = false;
    } else {
      request.votes.push(authUser._id);
      voted = true;
      // Notify the original requester
      if (request.requestedBy && String(request.requestedBy) !== String(authUser._id)) {
        await Notification.create({
          userId: request.requestedBy,
          type: 'request',
          title: `Someone else also wants "${request.title}" 🙌`,
          body: `${request.votes.length} people are now waiting for this ${request.type}. We're more likely to add it soon!`,
          link: '/requests',
        });
      }
    }
    await request.save();

    return res.json({
      message: voted ? 'Vote added!' : 'Vote removed',
      voteCount: request.votes.length,
      hasVoted: voted,
    });
  } catch (error: any) {
    console.error('voteRequest error:', error);
    return res.status(500).json({ message: 'Failed to vote' });
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

    // Notify everyone who requested / voted when the title is added
    if (updateFields.status === 'fulfilled') {
      const recipients = new Set<string>();
      if (request.requestedBy) recipients.add(String(request.requestedBy));
      request.votes.forEach((v) => recipients.add(String(v)));
      await Promise.all(
        Array.from(recipients).map((userId) =>
          Notification.create({
            userId,
            type: 'request',
            title: `"${request.title}" is now on CineStream! 🎉`,
            body: `You requested this ${request.type} — it has just been added to the catalog. Go watch it now!`,
            link: '/search',
          })
        )
      );
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
