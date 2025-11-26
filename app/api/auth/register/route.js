import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import logger from '@/config/logger';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    await connectDB();

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User registered: ${username}`);

    return NextResponse.json(
      {
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          username: user.username,
          status: user.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Registration error:', error);
    const status = error.status || 500;
    const message = error.status ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status });
  }
}

