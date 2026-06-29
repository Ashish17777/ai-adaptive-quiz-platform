const QuizRoom = require('../models/quizRoomModel');
const Quiz = require('../models/quizModel');

// Helper function to generate a random 6-digit room code
const generateUniqueRoomCode = async () => {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    // Generate a 6-digit string code
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const existingRoom = await QuizRoom.findOne({ roomCode: code });
    if (!existingRoom) {
      isUnique = true;
    }
  }

  return code;
};

// @desc    Create a new quiz room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res) => {
  try {
    const { quizId } = req.body;

    if (!quizId) {
      return res.status(400).json({ success: false, message: 'Please provide a quizId' });
    }

    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const roomCode = await generateUniqueRoomCode();

    const room = await QuizRoom.create({
      roomCode,
      quizId,
      hostId: req.user._id,
      status: 'waiting',
      currentQuestion: -1,
      participants: [],
    });

    res.status(201).json({
      success: true,
      room: {
        _id: room._id,
        roomCode: room.roomCode,
        quizId: room.quizId,
        hostId: room.hostId,
        status: room.status,
        currentQuestion: room.currentQuestion,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get room details by code
// @route   GET /api/rooms/:roomCode
// @access  Public
const getRoomByCode = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await QuizRoom.findOne({ roomCode })
      .populate('quizId', 'title description isAdaptive topic questions securitySettings')
      .populate('hostId', 'name email');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Quiz room not found' });
    }

    res.json({
      success: true,
      room,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createRoom,
  getRoomByCode,
};
