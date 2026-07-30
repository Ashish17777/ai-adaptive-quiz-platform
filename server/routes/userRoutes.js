const express = require('express');
const router = express.Router();
const { updateUserRole } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/role', protect, updateUserRole);

module.exports = router;
