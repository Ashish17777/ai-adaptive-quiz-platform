const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

let authInstance;
const getAuthInstance = async () => {
  if (!authInstance) {
    try {
      const { auth } = await import('../auth.mjs');
      authInstance = auth;
    } catch (err) {
      console.error('Error loading Better Auth in middleware:', err);
    }
  }
  return authInstance;
};

// Protect routes
const protect = async (req, res, next) => {
  // 1. Try Better Auth Session first
  try {
    const auth = await getAuthInstance();
    if (auth) {
      const session = await auth.api.getSession({
        headers: req.headers,
      });

      if (session) {
        req.user = {
          _id: session.user.id,
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role || 'student',
          currentStreak: session.user.currentStreak || 0,
          longestStreak: session.user.longestStreak || 0,
          lastActiveDate: session.user.lastActiveDate,
        };
        return next();
      }
    }
  } catch (error) {
    console.error('Better Auth session resolution error:', error);
  }

  // 2. Fallback to JWT Token validation
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

      // Get user from the token (exclude password)
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      console.error('JWT token fallback failed:', error);
    }
  }

  return res.status(401).json({ success: false, message: 'Not authorized, please authenticate' });
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
