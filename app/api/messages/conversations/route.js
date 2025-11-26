import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import logger from '@/config/logger';
import connectDB from '@/lib/mongoose';
import Message from '@/models/Message';
import { getUserFromHeaders } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const currentUser = await getUserFromHeaders(request.headers);
    const currentUserId = new mongoose.Types.ObjectId(currentUser._id);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: currentUserId }, { receiver: currentUserId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$sender', currentUserId] }, '$receiver', '$sender'],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ['$receiver', currentUserId] }, { $eq: ['$read', false] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          user: {
            id: '$user._id',
            username: '$user.username',
            status: '$user.status',
          },
          lastMessage: {
            content: '$lastMessage.content',
            createdAt: '$lastMessage.createdAt',
            sender: '$lastMessage.sender',
          },
          unreadCount: 1,
        },
      },
    ]);

    logger.info(`Conversations retrieved for user: ${currentUser._id}`);

    return NextResponse.json({ conversations });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    const status = error.status || 500;
    const message = error.status ? error.message : 'Failed to fetch conversations';
    return NextResponse.json({ error: message }, { status });
  }
}

