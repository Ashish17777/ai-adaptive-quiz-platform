const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// Dynamic Better Auth handler — loads AFTER dotenv is set up
let authHandler;
(async () => {
  try {
    await connectDB();
    const { toNodeHandler } = await import('better-auth/node');
    const { auth } = await import('./auth.mjs');
    authHandler = toNodeHandler(auth);
    console.log('Better Auth successfully initialized.');
  } catch (err) {
    console.error('Failed to initialize Better Auth:', err);
  }
})();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));

// Mount Better Auth handler BEFORE body parsers to prevent JSON parsing hangs on post streams
app.all('/api/auth/*', (req, res, next) => {
  if (authHandler) {
    authHandler(req, res, next);
  } else {
    res.status(503).json({ success: false, message: 'Auth service starting...' });
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Route Files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const questionRoutes = require('./routes/questionRoutes');
const quizRoutes = require('./routes/quizRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const roomRoutes = require('./routes/roomRoutes');

// Mount Routes
// NOTE: /api/auth/* is handled exclusively by Better Auth above.
// Legacy JWT routes moved to /api/legacy-auth for backward compatibility.
app.use('/api/legacy-auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rooms', roomRoutes);

// Mounting Attempts and Results
app.use('/api/attempts', attemptRoutes);

const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/analytics', analyticsRoutes);

const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);

const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);

const aiAnalyticsRoutes = require('./routes/aiAnalyticsRoutes');
app.use('/api', aiAnalyticsRoutes);

const securityRoutes = require('./routes/securityRoutes');
app.use('/api/security', securityRoutes);

// GET /api/results/:userId matches the exact requirement
const { getUserResults } = require('./controllers/attemptController');
const { protect } = require('./middleware/authMiddleware');
app.get('/api/results/:userId', protect, getUserResults);

// Simple Welcome Route
app.get('/', (req, res) => {
  res.send('AI Adaptive Quiz Platform API is running...');
});

// Setup socket connection handler
require('./socket')(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
