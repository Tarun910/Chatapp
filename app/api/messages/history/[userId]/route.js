import { NextResponse } from 'next/server';
import logger from '@/config/logger';
import connectDB from '@/lib/mongoose';
import Message from '@/models/Message';
import User from '@/models/User';
import { getUserFromHeaders } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const currentUser = await getUserFromHeaders(request.headers);
    const { userId } = params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: userId },
        { sender: userId, receiver: currentUser._id },
      ],
    })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ createdAt: 1 })
      .lean();

    logger.info(`Chat history retrieved: ${currentUser._id} <-> ${userId}`);

    return NextResponse.json({
      messages,
      count: messages.length,
    });
  } catch (error) {
    logger.error('Error fetching chat history:', error);
    const status = error.status || 500;
    const message = error.status ? error.message : 'Failed to fetch chat history';
    return NextResponse.json({ error: message }, { status });
  }
}

