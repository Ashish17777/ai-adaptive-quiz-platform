const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please add all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const userRole = role === 'admin' ? 'admin' : 'student';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
    });

    // Also update direct collection if better-auth mongodb adapter is used
    const mongoose = require('mongoose');
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('user').updateOne(
        { _id: user._id },
        { $set: { role: userRole } }
      ).catch(() => {});
      await mongoose.connection.db.collection('user').updateOne(
        { id: String(user._id) },
        { $set: { role: userRole } }
      ).catch(() => {});
    }

    if (user) {
      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate a user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password, role: requestedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user email (explicitly select password as it is false in model config)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If a specific role was selected on sign in (e.g. admin), update user role immediately
    if (requestedRole && ['student', 'admin'].includes(requestedRole)) {
      user.role = requestedRole;
      await user.save();

      const mongoose = require('mongoose');
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('user').updateOne(
          { _id: user._id },
          { $set: { role: requestedRole } }
        ).catch(() => {});
        await mongoose.connection.db.collection('user').updateOne(
          { id: String(user._id) },
          { $set: { role: requestedRole } }
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
