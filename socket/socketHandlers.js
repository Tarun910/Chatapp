const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../config/logger');

// Store active users (userId -> socketId)
const activeUsers = new Map();

const initializeSocketHandlers = (io) => {
  // Handle connection
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const username = socket.username;

    logger.info(`WebSocket event: connect - User: ${username} (${userId}), Socket: ${socket.id}`);

    // Add user to active users
    activeUsers.set(userId, socket.id);

    // Update user status to online
    User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: new Date(),
    }).catch((err) => logger.error('Error updating user status:', err));

    // Notify other users that this user is now online
    socket.broadcast.emit('user_status_change', {
      userId,
      username,
      status: 'online',
    });

    // Send list of online users with usernames to the newly connected user
    (async () => {
      try {
        const onlineUserIds = Array.from(activeUsers.keys());
        const onlineUsersData = await User.find({ _id: { $in: onlineUserIds } })
          .select('_id username')
          .lean();
        socket.emit('online_users', onlineUsersData.map(user => ({
          userId: user._id.toString(),
          username: user.username
        })));
      } catch (err) {
        logger.error('Error fetching online users:', err);
        // Fallback to just IDs if there's an error
        socket.emit('online_users', Array.from(activeUsers.keys()));
      }
    })();

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content } = data;

        if (!receiverId || !content) {
          socket.emit('error', { message: 'Receiver ID and content are required' });
          return;
        }

        logger.info(`WebSocket event: send_message - From: ${username} (${userId}), To: ${receiverId}, Content: ${content.substring(0, 50)}...`);

        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }

        // Create and save message
        const message = new Message({
          sender: userId,
          receiver: receiverId,
          content,
        });
        await message.save();

        // Populate sender and receiver for response
        await message.populate('sender', 'username');
        await message.populate('receiver', 'username');

        // Send message to receiver if online
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', {
            message: message.toObject(),
            event: 'receive_message',
          });
          logger.info(`WebSocket event: receive_message - To: ${receiver.username} (${receiverId})`);
        }

        // Confirm message sent to sender
        socket.emit('message_sent', {
          message: message.toObject(),
          event: 'message_sent',
        });

        logger.info(`Message sent successfully: ${userId} -> ${receiverId}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { receiverId, isTyping } = data;
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId,
          username,
          isTyping,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      logger.info(`WebSocket event: disconnect - User: ${username} (${userId}), Socket: ${socket.id}`);

      // Remove user from active users
      activeUsers.delete(userId);

      // Update user status to offline
      try {
        await User.findByIdAndUpdate(userId, {
          status: 'offline',
          lastSeen: new Date(),
        });

        // Notify other users that this user is now offline
        socket.broadcast.emit('user_status_change', {
          userId,
          username,
          status: 'offline',
        });
      } catch (error) {
        logger.error('Error updating user status on disconnect:', error);
      }
    });
  });
};

module.exports = { initializeSocketHandlers, activeUsers };

