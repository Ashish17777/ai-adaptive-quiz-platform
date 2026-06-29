const express = require('express');
const router = express.Router();
const { createRoom, getRoomByCode } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createRoom);
router.get('/:roomCode', getRoomByCode);

module.exports = router;
