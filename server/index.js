require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const { connectDB } = require('./config/database');
const { initFirebase } = require('./config/firebase');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// Initialize Firebase and MongoDB
initFirebase();
connectDB();

// Redis adapter for Socket.io scaling (optional - use if REDIS_URL is set)
if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Redis adapter connected');
    }).catch((err) => {
      console.warn('Redis connection failed, using default Socket.io adapter:', err.message);
    });
  } catch (error) {
    console.warn('Redis initialization failed, using default Socket.io adapter:', error.message);
  }
}

// Routes
const tripsRouter = require('./routes/trips');
tripsRouter.setIO(io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', authMiddleware, tripsRouter);
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/comments', authMiddleware, require('./routes/comments'));

// Socket.io connection
const activePresence = new Map(); // Track active users per trip

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-trip', (data) => {
    const { tripId, userId, userEmail } = data;
    socket.join(`trip:${tripId}`);

    // Track presence
    const presenceKey = `${tripId}:${userId}`;
    activePresence.set(presenceKey, {
      userId,
      userEmail,
      socketId: socket.id,
      status: 'viewing',
      connectedAt: new Date(),
    });

    // Get all active users for this trip
    const tripUsers = Array.from(activePresence.entries())
      .filter(([key]) => key.startsWith(`${tripId}:`))
      .map(([, presence]) => presence);

    // Broadcast updated presence
    io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: tripUsers });
  });

  socket.on('presence:startEdit', (data) => {
    const { tripId, userId, itemId } = data;
    const presenceKey = `${tripId}:${userId}`;
    const presence = activePresence.get(presenceKey);

    if (presence) {
      presence.status = 'editing';
      presence.editingItemId = itemId;

      const tripUsers = Array.from(activePresence.entries())
        .filter(([key]) => key.startsWith(`${tripId}:`))
        .map(([, p]) => p);

      io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: tripUsers });
    }
  });

  socket.on('presence:stopEdit', (data) => {
    const { tripId, userId } = data;
    const presenceKey = `${tripId}:${userId}`;
    const presence = activePresence.get(presenceKey);

    if (presence) {
      presence.status = 'viewing';
      presence.editingItemId = null;

      const tripUsers = Array.from(activePresence.entries())
        .filter(([key]) => key.startsWith(`${tripId}:`))
        .map(([, p]) => p);

      io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: tripUsers });
    }
  });

  socket.on('leave-trip', (tripId) => {
    socket.leave(`trip:${tripId}`);

    // Remove presence entries for this socket
    for (const [key, presence] of activePresence.entries()) {
      if (presence.socketId === socket.id) {
        activePresence.delete(key);
      }
    }

    // Broadcast updated presence
    const remaining = Array.from(activePresence.entries())
      .filter(([key]) => key.startsWith(`${tripId}:`))
      .map(([, p]) => p);

    io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: remaining });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Clean up presence
    for (const [key, presence] of activePresence.entries()) {
      if (presence.socketId === socket.id) {
        activePresence.delete(key);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
