import { Server } from 'socket.io';
import connectDB from '@/lib/mongoose';
import { initializeSocketHandlers } from '@/socket/socketHandlers';
import { authenticateSocket } from '@/middleware/auth';

const ioHandler = async (req, res) => {
  if (!res.socket.server.io) {
    await connectDB();
    const io = new Server(res.socket.server, {
      path: '/api/socketio',
      cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    io.use(authenticateSocket);
    initializeSocketHandlers(io);
    res.socket.server.io = io;
  }

  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ioHandler;

