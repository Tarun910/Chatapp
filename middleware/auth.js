const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

const buildError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const verifyToken = async (token) => {
  if (!token) {
    throw buildError(401, 'Access token required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw buildError(401, 'Token expired');
    }
    throw buildError(401, 'Invalid token');
  }

  const user = await User.findById(decoded.userId).select('-password');

  if (!user) {
    throw buildError(401, 'User not found');
  }

  return user;
};

const getUserFromHeaders = async (headers) => {
  const headerValue =
    typeof headers?.get === 'function'
      ? headers.get('authorization')
      : headers?.authorization || headers?.Authorization;
  const token = headerValue?.split(' ')[1];
  return verifyToken(token);
};

// Middleware to verify JWT token for Socket.io connections
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    const user = await verifyToken(token);

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    }
    const message = error.status === 401 ? error.message : 'Authentication error: Authentication failed';
    next(new Error(message));
  }
};

module.exports = {
  getUserFromHeaders,
  authenticateSocket,
};

