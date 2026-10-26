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
const { verifyToken, getSecret } = require('./services/auth');
const Trip = require('./models/Trip');
const User = require('./models/User');

getSecret(); // fail fast if JWT_SECRET is missing

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
const pollsRouter = require('./routes/polls');
pollsRouter.setIO(io);
const expensesRouter = require('./routes/expenses');
expensesRouter.setIO(io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', authMiddleware, tripsRouter);
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/comments', authMiddleware, require('./routes/comments'));
app.use('/api/polls', authMiddleware, pollsRouter);
app.use('/api/expenses', authMiddleware, expensesRouter);
app.use('/api/notifications', authMiddleware, require('./routes/notifications'));

// Socket.io connection
const activePresence = new Map(); // Track active users per trip

const liveLocations = new Map(); // `${tripId}:${userId}` -> latest shared location
const LOCATION_MIN_INTERVAL_MS = 1000;
const LOCATION_STALE_MS = 5 * 60 * 1000;

const publicLocation = ({ userId, userEmail, lat, lng, accuracy, updatedAt }) => ({
  userId,
  userEmail,
  lat,
  lng,
  accuracy,
  updatedAt,
});

// Stop sharing for a socket (optionally only within one trip) and tell the trip room
function clearLocationsForSocket(socketId, onlyTripId) {
  for (const [key, loc] of liveLocations.entries()) {
    const tripId = key.slice(0, key.lastIndexOf(':'));
    if (loc.socketId !== socketId || (onlyTripId && tripId !== onlyTripId)) continue;
    liveLocations.delete(key);
    io.to(`trip:${tripId}`).emit('location:stopped', { userId: loc.userId });
  }
}

// Drop locations that stopped updating (e.g. a phone that lost signal)
setInterval(() => {
  const cutoff = Date.now() - LOCATION_STALE_MS;
  for (const [key, loc] of liveLocations.entries()) {
    if (loc.updatedAt >= cutoff) continue;
    liveLocations.delete(key);
    io.to(`trip:${key.slice(0, key.lastIndexOf(':'))}`).emit('location:stopped', { userId: loc.userId });
  }
}, 60 * 1000).unref();

// Reject connections without a valid token; identity comes from the token, never from client events
io.use((socket, next) => {
  try {
    const decoded = verifyToken(socket.handshake.auth?.token);
    socket.data.uid = decoded.uid;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-trip', async (data) => {
    try {
      const tripId = data?.tripId;
      const userId = socket.data.uid;
      if (typeof tripId !== 'string') return;

      const trip = await Trip.findOne({ groupId: tripId });
      const isMember = trip?.members.some((m) => m.userId === userId && m.status === 'active');
      if (!isMember) {
        socket.emit('trip:forbidden', { tripId });
        return;
      }

      const user = await User.findOne({ uid: userId });
      const userEmail = user?.email;
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

      // Let the joiner see everyone who is currently sharing their location
      const sharing = Array.from(liveLocations.entries())
        .filter(([key]) => key.startsWith(`${tripId}:`))
        .map(([, loc]) => publicLocation(loc));
      socket.emit('location:snapshot', { locations: sharing });
    } catch (err) {
      console.error('join-trip error:', err.message);
    }
  });

  socket.on('presence:startEdit', (data) => {
    const { tripId, itemId } = data || {};
    const userId = socket.data.uid;
    const presenceKey = `${tripId}:${userId}`;
    const presence = activePresence.get(presenceKey);

    if (presence && presence.socketId === socket.id) {
      presence.status = 'editing';
      presence.editingItemId = itemId;

      const tripUsers = Array.from(activePresence.entries())
        .filter(([key]) => key.startsWith(`${tripId}:`))
        .map(([, p]) => p);

      io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: tripUsers });
    }
  });

  socket.on('presence:stopEdit', (data) => {
    const { tripId } = data || {};
    const userId = socket.data.uid;
    const presenceKey = `${tripId}:${userId}`;
    const presence = activePresence.get(presenceKey);

    if (presence && presence.socketId === socket.id) {
      presence.status = 'viewing';
      presence.editingItemId = null;

      const tripUsers = Array.from(activePresence.entries())
        .filter(([key]) => key.startsWith(`${tripId}:`))
        .map(([, p]) => p);

      io.to(`trip:${tripId}`).emit('presence:update', { activeUsers: tripUsers });
    }
  });


  // Live location sharing: opt-in, in-memory only (never persisted), visible to active trip members
  socket.on('location:update', (data) => {
    const { tripId, lat, lng, accuracy } = data || {};
    const userId = socket.data.uid;
    if (typeof tripId !== 'string' || !socket.rooms.has(`trip:${tripId}`)) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

    const key = `${tripId}:${userId}`;
    const existing = liveLocations.get(key);
    const now = Date.now();
    if (existing && existing.socketId === socket.id && now - existing.updatedAt < LOCATION_MIN_INTERVAL_MS) return;

    const presence = activePresence.get(key);
    const location = {
      userId,
      userEmail: presence?.userEmail,
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      updatedAt: now,
      socketId: socket.id,
    };
    liveLocations.set(key, location);
    io.to(`trip:${tripId}`).emit('location:update', publicLocation(location));
  });

  socket.on('location:stop', (data) => {
    const tripId = data?.tripId;
    const key = `${tripId}:${socket.data.uid}`;
    const existing = liveLocations.get(key);
    if (existing && existing.socketId === socket.id) {
      liveLocations.delete(key);
      io.to(`trip:${tripId}`).emit('location:stopped', { userId: socket.data.uid });
    }
  });

  socket.on('leave-trip', (tripId) => {
    socket.leave(`trip:${tripId}`);
    clearLocationsForSocket(socket.id, tripId);

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
    clearLocationsForSocket(socket.id);

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
