//src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/history/:friendId', protect, chatController.getHistory);
router.post('/upload', protect, upload.single('file'), chatController.uploadMedia);
router.post('/fcm-token', protect, chatController.updateFCMToken);

module.exports = router;
