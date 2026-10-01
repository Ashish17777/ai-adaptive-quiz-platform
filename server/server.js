const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Create app and server BEFORE startServer so they are in scope
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Route Files
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const quizRoutes = require('./routes/quizRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const roomRoutes = require('./routes/roomRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
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

// Connect to DB then start listening
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ Failed to connect to database:', err.message);
  process.exit(1);
});
