const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { validateEmailDomain } = require('../utils/emailValidator');
const { sendOTPEmail } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// Helper: Generate 6-Digit Random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register a new user (with MX/Disposable check + Email OTP)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please add all fields' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Validate email domain (Check MX records and block disposable domains)
    const domainCheck = await validateEmailDomain(cleanEmail);
    if (!domainCheck.isValid) {
      return res.status(400).json({ success: false, message: domainCheck.error });
    }

    // 2. Check if user exists
    let user = await User.findOne({ email: cleanEmail });
    if (user && user.isVerified) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 Minutes
    const userRole = role === 'admin' ? 'admin' : 'student';

    if (user && !user.isVerified) {
      // Re-use unverified record
      user.name = name;
      user.password = password;
      user.role = userRole;
      user.otpCode = otpCode;
      user.otpExpiresAt = otpExpiresAt;
      await user.save();
    } else {
      // Create new unverified user
      user = await User.create({
        name,
        email: cleanEmail,
        password,
        role: userRole,
        isVerified: false,
        otpCode,
        otpExpiresAt,
      });
    }

    // 3. Send OTP Email via Resend / Logger Service
    await sendOTPEmail(user.email, user.name, otpCode);

    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: user.email,
      message: 'Verification code sent to your email address.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP Code & Activate Account
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ success: false, message: 'Please provide email and verification code' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified. Please log in.' });
    }

    if (!user.otpCode || user.otpCode !== otpCode.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    if (new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    // Activate Account
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      message: 'Email verified successfully!',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend OTP Verification Code
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified.' });
    }

    const newOtp = generateOTP();
    user.otpCode = newOtp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(user.email, user.name, newOtp);

    res.json({
      success: true,
      message: 'A fresh verification code has been sent to your email.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate user via Google OAuth 2.0
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { credential, role } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    let payload = null;

    // Verify Google ID Token
    if (process.env.VITE_GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.VITE_GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (e) {
        console.warn('Google ID token verification failed with Client ID, attempting fallback payload decode');
      }
    }

    // Fallback parsing if payload not decoded by client ticket
    if (!payload) {
      const parts = credential.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      }
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google login payload' });
    }

    const { email, name, sub: googleId } = payload;
    const cleanEmail = email.toLowerCase();

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Create user automatically from Google Profile
      const randomPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const userRole = role === 'admin' ? 'admin' : 'student';

      user = await User.create({
        name: name || 'Google User',
        email: cleanEmail,
        password: randomPassword,
        role: userRole,
        isVerified: true, // Google emails are pre-verified
        googleId,
      });
    } else {
      // Update googleId and mark verified if logging in via Google
      if (!user.isVerified) user.isVerified = true;
      if (!user.googleId) user.googleId = googleId;
      await user.save();
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      message: 'Google login successful!',
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Google Authentication failed' });
  }
};

// @desc    Authenticate a user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Block login if user email is not verified
    if (!user.isVerified) {
      // Trigger new OTP so they can verify right away
      const newOtp = generateOTP();
      user.otpCode = newOtp;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendOTPEmail(user.email, user.name, newOtp);

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: 'Your email address is not verified. A new 6-digit OTP code has been sent to your email.',
      });
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

// Helper for generating secure random password
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

// @desc    Bulk import students from document file (CSV, JSON, TXT)
// @route   POST /api/auth/bulk-import-students
// @access  Private (Admin)
const bulkImportStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a document file (.csv, .json, .txt)' });
    }

    const { parseDocument } = require('../utils/documentParser');
    const parsedStudents = parseDocument(req.file.buffer, req.file.originalname, req.file.mimetype);

    if (!parsedStudents || parsedStudents.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid student records found in the uploaded file' });
    }

    const createdStudents = [];
    const skippedStudents = [];

    for (const record of parsedStudents) {
      const cleanEmail = record.email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        skippedStudents.push({
          name: record.name,
          email: cleanEmail,
          reason: 'Email already exists',
        });
        continue;
      }

      // Auto-generate password if not provided
      const rawPassword = record.password || generateRandomPassword();

      const newUser = await User.create({
        name: record.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: rawPassword,
        role: 'student',
        isVerified: true, // Auto-verify imported accounts created by Admin
      });

      createdStudents.push({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        generatedPassword: rawPassword,
      });
    }

    res.json({
      success: true,
      message: `Processed ${parsedStudents.length} records. Created ${createdStudents.length}, skipped ${skippedStudents.length}.`,
      totalProcessed: parsedStudents.length,
      createdCount: createdStudents.length,
      skippedCount: skippedStudents.length,
      createdStudents,
      skippedStudents,
    });
  } catch (error) {
    console.error('Bulk Student Import Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to import students' });
  }
};

// @desc    Clear all student records (removes all users with role 'student')
// @route   DELETE /api/auth/clear-students
// @access  Private (Admin)
const clearAllStudents = async (req, res) => {
  try {
    const result = await User.deleteMany({ role: 'student' });
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} student accounts from the database.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Clear Students Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete student accounts' });
  }
};

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  googleAuth,
  loginUser,
  bulkImportStudents,
  clearAllStudents,
};
