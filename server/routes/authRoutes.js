const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { protect, authorize } = require('../middleware/authMiddleware');

const {
  registerUser,
  verifyOTP,
  resendOTP,
  googleAuth,
  loginUser,
  bulkImportStudents,
  clearAllStudents,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/google', googleAuth);
router.post('/login', loginUser);
router.post('/bulk-import-students', protect, authorize('admin'), upload.single('file'), bulkImportStudents);
router.delete('/clear-students', protect, authorize('admin'), clearAllStudents);

module.exports = router;
