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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', authMiddleware, require('./routes/trips'));
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/comments', authMiddleware, require('./routes/comments'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-trip', (tripId) => {
    socket.join(`trip:${tripId}`);
    io.to(`trip:${tripId}`).emit('user-joined', { userId: socket.id, tripId });
  });

  socket.on('leave-trip', (tripId) => {
    socket.leave(`trip:${tripId}`);
    io.to(`trip:${tripId}`).emit('user-left', { userId: socket.id, tripId });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
