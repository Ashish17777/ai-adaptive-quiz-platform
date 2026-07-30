const User = require('../models/userModel');

// @desc    Update user role
// @route   PUT /api/user/role
// @access  Private
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['student', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be student or admin.' });
    }

    const userId = req.user._id || req.user.id;

    // Update in Mongoose / MongoDB user collection
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    );

    // Also update via direct db collection if MongoDB adapter is used by Better Auth
    const mongoose = require('mongoose');
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('user').updateOne(
        { _id: userId },
        { $set: { role } }
      ).catch(() => {});
      
      // Also try string ID if _id stored as string in better-auth
      await mongoose.connection.db.collection('user').updateOne(
        { id: String(userId) },
        { $set: { role } }
      ).catch(() => {});
    }

    return res.json({
      success: true,
      message: `Role updated to ${role}`,
      user: {
        id: userId,
        role: role,
      },
    });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  updateUserRole,
};
