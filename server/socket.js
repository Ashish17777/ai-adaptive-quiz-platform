const QuizRoom = require('./models/quizRoomModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel'); // Ensure Quiz model is registered for populate

const DIFFICULTY_SCORES = {
  easy: 100,
  medium: 200,
  hard: 300,
  expert: 400,
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join attempt room (for student real-time sync)
    socket.on('join-attempt', ({ attemptId }) => {
      console.log(`Socket ${socket.id} joining attempt room: attempt_${attemptId}`);
      socket.join(`attempt_${attemptId}`);
    });

    // Join admin security room (for admin audit logs/panel)
    socket.on('join-admin-security', () => {
      console.log(`Admin socket ${socket.id} joining admin_security room`);
      socket.join('admin_security');
    });

    // Join room event (for both host and student)
    socket.on('join-room', async ({ roomCode, name, userId, role }) => {
      try {
        console.log(`Socket ${socket.id} joining room ${roomCode} as ${role} (${name})`);
        
        // Find the room
        let room = await QuizRoom.findOne({ roomCode });
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.role = role;
        socket.name = name;

        if (role === 'student') {
          // Find the room
          let roomToUpdate = await QuizRoom.findOne({ roomCode });
          if (!roomToUpdate) {
            socket.emit('error', 'Room not found');
            return;
          }

          // Check if player already exists in the room
          let participant = roomToUpdate.participants.find(p => 
            p.name === name || (userId && p.userId && p.userId.toString() === userId.toString())
          );

          if (participant) {
            // Update existing participant socket ID
            participant.socketId = socket.id;
          } else {
            // Add new participant
            roomToUpdate.participants.push({
              socketId: socket.id,
              userId: userId || null,
              name: name,
              score: 0,
              confidenceScore: 0,
              overconfidenceCount: 0,
              underconfidenceCount: 0,
              confidenceAccuracyIndex: 0,
              currentDifficulty: 'medium',
              correctStreak: 0,
              wrongStreak: 0,
              questionsAnswered: 0,
              adaptiveScore: 0,
              answers: [],
            });
          }

          await roomToUpdate.save();
          let updatedRoom = roomToUpdate;

          // Populate the room details
          const populatedRoom = await QuizRoom.populate(updatedRoom, [
            { path: 'quizId', select: 'title description isAdaptive topic questions securitySettings' },
            { path: 'hostId', select: 'name email' }
          ]);

          // Notify everyone in the room about the updated list
          io.to(roomCode).emit('room-updated', populatedRoom);
        } else if (role === 'host') {
          // If host joins, send the current room details back to them
          const populatedRoom = await QuizRoom.findOne({ roomCode })
            .populate('quizId', 'title description isAdaptive topic questions securitySettings')
            .populate('hostId', 'name email');
          
          socket.emit('room-updated', populatedRoom);
        }
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Start quiz event (host starts the quiz)
    socket.on('start-quiz', async ({ roomCode }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode });
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        room.status = 'active';
        room.currentQuestion = 0;
        await room.save();

        // Broadcast to all participants that the quiz has started
        io.to(roomCode).emit('quiz-started', roomCode);
      } catch (error) {
        console.error('Start quiz error:', error);
        socket.emit('error', 'Failed to start quiz');
      }
    });

    // Fetch next adaptive question for player
    socket.on('get-next-question', async ({ roomCode }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode }).populate('quizId');
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        if (room.status !== 'active') {
          socket.emit('error', 'Quiz is not active');
          return;
        }

        if (!room.quizId) {
          socket.emit('error', 'The quiz associated with this room no longer exists.');
          return;
        }

        const participant = room.participants.find(p => p.socketId === socket.id);
        if (!participant) {
          socket.emit('error', 'Participant not found');
          return;
        }

        const MAX_MULTIPLAYER_QUESTIONS = 8;
        if (participant.questionsAnswered >= MAX_MULTIPLAYER_QUESTIONS || participant.isCompleted) {
          participant.isCompleted = true;
          await room.save();
          socket.emit('quiz-finished', { score: participant.score, adaptiveScore: participant.adaptiveScore });
          return;
        }

        const answeredQuestionIds = participant.answers.map(ans => ans.questionId);
        let targetDifficulty = participant.currentDifficulty;
        let question = null;

        // Fetch question based on quiz type (Adaptive vs Static)
        if (room.quizId.isAdaptive) {
          // Find next question in topic of target difficulty not already answered by student
          question = await Question.findOne({
            topic: room.quizId.topic,
            difficulty: targetDifficulty,
            _id: { $nin: answeredQuestionIds },
          });

          // Fallback if no questions are available at the targeted difficulty
          if (!question) {
            // Try matching any other difficulty the user hasn't seen yet in this topic
            question = await Question.findOne({
              topic: room.quizId.topic,
              _id: { $nin: answeredQuestionIds },
            });
          }
        } else {
          // Static Quiz: Filter the pre-defined questions that match target difficulty first
          const poolQuestionIds = room.quizId.questions.filter(id => !answeredQuestionIds.some(ansId => ansId.toString() === id.toString()));
          
          if (poolQuestionIds.length > 0) {
            // Find one that matches target difficulty
            const questionsInPool = await Question.find({ _id: { $in: poolQuestionIds } });
            question = questionsInPool.find(q => q.difficulty === targetDifficulty);
            
            // Fallback to any remaining question in the static pool
            if (!question && questionsInPool.length > 0) {
              question = questionsInPool[0];
            }
          }
        }

        if (!question) {
          // No more questions left!
          participant.isCompleted = true;
          await room.save();
          socket.emit('quiz-finished', { score: participant.score, adaptiveScore: participant.adaptiveScore });
          return;
        }

        // Return question details (omit correctAnswer for security)
        socket.emit('next-question', {
          question: {
            _id: question._id,
            questionText: question.questionText,
            options: question.options,
            difficulty: question.difficulty,
            topic: question.topic,
          },
          questionNumber: participant.questionsAnswered + 1,
          totalQuestions: MAX_MULTIPLAYER_QUESTIONS,
        });

      } catch (error) {
        console.error('Get next question error:', error);
        socket.emit('error', 'Failed to retrieve question');
      }
    });

    // Student submits multiplayer question answer
    socket.on('submit-multiplayer-answer', async ({ roomCode, questionId, answerIndex, confidenceLevel, timeTaken }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode });
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        const participant = room.participants.find(p => p.socketId === socket.id);
        if (!participant) {
          socket.emit('error', 'Participant not found');
          return;
        }

        const question = await Question.findById(questionId);
        if (!question) {
          socket.emit('error', 'Question not found');
          return;
        }

        // Check correctness
        const isCorrect = question.correctAnswer === Number(answerIndex);
        const level = (confidenceLevel || 'medium').toLowerCase();

        // Calculate confidence score added/subtracted
        let scoreAdded = 0;
        if (isCorrect) {
          if (level === 'high') scoreAdded = 150;
          else if (level === 'medium') scoreAdded = 100;
          else scoreAdded = 80;
        } else {
          if (level === 'high') scoreAdded = -50;
          else if (level === 'medium') scoreAdded = -20;
          else scoreAdded = 0;
        }

        // Update streaks
        if (isCorrect) {
          participant.correctStreak += 1;
          participant.wrongStreak = 0;
          participant.adaptiveScore += (DIFFICULTY_SCORES[question.difficulty] || 100);
        } else {
          participant.correctStreak = 0;
          participant.wrongStreak += 1;
        }

        // Update counts and confidence score
        participant.questionsAnswered += 1;
        participant.confidenceScore += scoreAdded;
        participant.score += scoreAdded; // Leaderboard uses confidence score

        // Over/Underconfidence checks
        if (!isCorrect && level === 'high') {
          participant.overconfidenceCount += 1;
        }
        if (isCorrect && level === 'low') {
          participant.underconfidenceCount += 1;
        }

        // Record the answer
        participant.answers.push({
          questionId: question._id,
          answerIndex: Number(answerIndex),
          correctAnswer: question.correctAnswer,
          isCorrect,
          confidenceLevel: level,
          timeTaken: Number(timeTaken) || 0,
          difficulty: question.difficulty,
          topic: question.topic,
          scoreAdded: scoreAdded,
        });

        // Recalculate confidence accuracy index
        let matchedCount = 0;
        participant.answers.forEach((ans) => {
          const ansLevel = (ans.confidenceLevel || 'medium').toLowerCase();
          const ansCorrect = ans.isCorrect;
          const isMatch = (ansCorrect && (ansLevel === 'high' || ansLevel === 'medium')) ||
                          (!ansCorrect && ansLevel === 'low');
          if (isMatch) {
            matchedCount++;
          }
        });
        participant.confidenceAccuracyIndex = participant.answers.length > 0
          ? Math.round((matchedCount / participant.answers.length) * 100)
          : 0;

        // Adjust difficulty tier
        let nextDifficulty = participant.currentDifficulty;
        if (isCorrect) {
          if (participant.currentDifficulty === 'easy') {
            nextDifficulty = 'medium';
          } else if (participant.currentDifficulty === 'medium') {
            nextDifficulty = 'hard';
          } else if (participant.currentDifficulty === 'hard') {
            nextDifficulty = 'expert';
          }
        } else {
          if (participant.currentDifficulty === 'expert') {
            nextDifficulty = 'hard';
          } else if (participant.currentDifficulty === 'hard') {
            nextDifficulty = 'medium';
          } else if (participant.currentDifficulty === 'medium') {
            nextDifficulty = 'easy';
          }
        }
        participant.currentDifficulty = nextDifficulty;

        await room.save();

        // Send feedback to student
        socket.emit('answer-feedback', {
          isCorrect,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation || 'No explanation provided for this question.',
        });

        // Broadcast updated room state to update host dashboard leaderboard
        const updatedRoom = await QuizRoom.findOne({ roomCode })
          .populate('quizId', 'title description isAdaptive topic questions securitySettings')
          .populate('hostId', 'name email');

        io.to(roomCode).emit('room-updated', updatedRoom);

      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', 'Failed to submit answer');
      }
    });

    // Early Finish Quiz event (student completes early)
    socket.on('finish-multiplayer-quiz', async ({ roomCode }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode });
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        const participant = room.participants.find(p => p.socketId === socket.id);
        if (!participant) {
          socket.emit('error', 'Participant not found');
          return;
        }

        participant.isCompleted = true;
        await room.save();

        // Emit finished state back to the student
        socket.emit('quiz-finished', { score: participant.score, adaptiveScore: participant.adaptiveScore });

        // Broadcast updated room state to update host dashboard
        const updatedRoom = await QuizRoom.findOne({ roomCode })
          .populate('quizId', 'title description isAdaptive topic questions securitySettings')
          .populate('hostId', 'name email');

        io.to(roomCode).emit('room-updated', updatedRoom);
      } catch (error) {
        console.error('Finish multiplayer quiz error:', error);
        socket.emit('error', 'Failed to finish quiz early');
      }
    });

    socket.on('student-security-event', async ({ roomCode, eventType, metadata = {} }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode }).populate('quizId');
        if (!room) return;

        const participant = room.participants.find(p => p.socketId === socket.id);
        if (!participant) return;

        // Verify if the quiz actually enforces security lockdown
        if (!room.quizId?.securitySettings?.enforceSecurity) return;

        let alertMsg = `Violation detected: ${eventType}`;
        if (eventType === 'TAB_SWITCH') {
          participant.tabSwitchCount += 1;
          alertMsg = 'Tab switch detected';
        } else if (eventType === 'FOCUS_LOSS') {
          participant.focusLossCount += 1;
          alertMsg = 'Window focus lost';
        } else if (['COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT'].includes(eventType)) {
          participant.copyPasteCutCount += 1;
          alertMsg = 'Clipboard copy/paste blocked';
        } else if (eventType === 'RIGHT_CLICK_ATTEMPT') {
          participant.rightClickCount += 1;
          alertMsg = 'Right-click menu blocked';
        } else if (eventType === 'SCREENSHOT_ATTEMPT') {
          participant.screenshotCount += 1;
          alertMsg = 'Screenshot attempt detected';
        } else if (eventType === 'FULLSCREEN_EXIT') {
          participant.fullscreenExitCount += 1;
          alertMsg = 'Fullscreen mode exited';
        } else if (['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'CAMERA_DISCONNECT', 'CAMERA_PERMISSION_DENIED'].includes(eventType)) {
          participant.cameraViolationCount += 1;
          alertMsg = `Webcam integrity alert: ${eventType.replace(/_/g, ' ')}`;
        }

        // Add to recent security alerts feed
        participant.securityAlerts.push({
          eventType,
          message: alertMsg,
          timestamp: new Date(),
        });

        // Keep at most 20 recent alerts to prevent massive doc sizes
        if (participant.securityAlerts.length > 20) {
          participant.securityAlerts.shift();
        }

        // Calculate cheating risk score
        let riskScore = 0;
        if (participant.tabSwitchCount > 0) riskScore += Math.min(participant.tabSwitchCount * 15, 30);
        if (participant.focusLossCount > 0) riskScore += Math.min(participant.focusLossCount * 10, 20);
        if (participant.copyPasteCutCount > 0) riskScore += Math.min(participant.copyPasteCutCount * 15, 25);
        if (participant.rightClickCount > 0) riskScore += Math.min(participant.rightClickCount * 10, 15);
        if (participant.screenshotCount > 0) riskScore += Math.min(participant.screenshotCount * 25, 50);
        if (participant.fullscreenExitCount > 0) riskScore += Math.min(participant.fullscreenExitCount * 30, 60);
        if (participant.cameraViolationCount > 0) riskScore += Math.min(participant.cameraViolationCount * 35, 70);

        riskScore = Math.min(riskScore, 100);
        participant.riskScore = riskScore;
        
        if (riskScore > 70) {
          participant.riskCategory = 'High Risk';
        } else if (riskScore > 35) {
          participant.riskCategory = 'Medium Risk';
        } else {
          participant.riskCategory = 'Low Risk';
        }

        participant.violationsCount =
          participant.tabSwitchCount +
          participant.fullscreenExitCount +
          participant.copyPasteCutCount +
          participant.screenshotCount +
          participant.cameraViolationCount;

        // Auto-submit checks
        const limits = room.quizId.securitySettings.violationLimits || 5;
        const allowedTabs = room.quizId.securitySettings.allowedTabSwitches || 3;
        const screenEnforced = room.quizId.securitySettings.fullScreenEnforced || false;

        let shouldAutoSubmit = false;
        let autoSubmitReason = '';

        if (participant.violationsCount >= limits) {
          shouldAutoSubmit = true;
          autoSubmitReason = `Exceeded total violations limit (${participant.violationsCount}/${limits})`;
        } else if (participant.tabSwitchCount > allowedTabs) {
          shouldAutoSubmit = true;
          autoSubmitReason = `Exceeded allowed tab switches (${participant.tabSwitchCount}/${allowedTabs})`;
        } else if (screenEnforced && participant.fullscreenExitCount > 1) {
          shouldAutoSubmit = true;
          autoSubmitReason = `Exited fullscreen mode under enforced lockdown`;
        }

        const attemptsRemaining = Math.max(0, limits - participant.violationsCount);

        // Emit specific Socket.IO events to the student
        socket.emit('violation_detected', {
          eventType,
          violationsCount: participant.violationsCount,
          maxViolations: limits,
          securityAlerts: participant.securityAlerts,
        });

        socket.emit('risk_score_updated', {
          riskScore: participant.riskScore,
          riskCategory: participant.riskCategory,
        });

        socket.emit('attempts_remaining_updated', {
          attemptsRemaining,
        });

        if (shouldAutoSubmit) {
          participant.isCompleted = true;
          await room.save();
          socket.emit('security-auto-submit', { reason: autoSubmitReason });
          socket.emit('exam_terminated', { reason: autoSubmitReason });
        } else {
          await room.save();
        }

        // Broadcast updated room state
        const updatedRoom = await QuizRoom.findOne({ roomCode })
          .populate('quizId', 'title description isAdaptive topic questions securitySettings')
          .populate('hostId', 'name email');

        io.to(roomCode).emit('room-updated', updatedRoom);
      } catch (error) {
        console.error('Error handling student security event:', error);
      }
    });

    // End quiz event (host terminates the quiz session)
    socket.on('end-quiz', async ({ roomCode }) => {
      try {
        const room = await QuizRoom.findOne({ roomCode });
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        room.status = 'completed';
        await room.save();

        // Broadcast to everyone in the room that the quiz has ended
        io.to(roomCode).emit('quiz-ended', roomCode);
      } catch (error) {
        console.error('End quiz error:', error);
        socket.emit('error', 'Failed to end quiz');
      }
    });

    // Disconnect event
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.roomCode && socket.role === 'student') {
        try {
          const room = await QuizRoom.findOne({ roomCode: socket.roomCode });
          if (room) {
            // Remove participant from the database room ONLY if the status is waiting
            if (room.status === 'waiting') {
              room.participants = room.participants.filter(p => p.socketId !== socket.id);
              await room.save();

              // Broadcast the updated participant list
              const updatedRoom = await QuizRoom.findOne({ roomCode: socket.roomCode })
                .populate('quizId', 'title description isAdaptive topic questions securitySettings')
                .populate('hostId', 'name email');
                
              io.to(socket.roomCode).emit('room-updated', updatedRoom);
            } else {
              // For active or completed rooms, do not delete them so their scores remain in the list
              console.log(`Student disconnected from active/completed room ${socket.roomCode}. Keeping record in database.`);
            }
          }
        } catch (error) {
          console.error('Error handling player disconnect:', error);
        }
      }
    });
  });
};
