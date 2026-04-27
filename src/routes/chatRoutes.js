//src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/history/:friendId', protect, chatController.getHistory);
router.get('/unread-count', protect, chatController.getUnreadCount);
router.post('/read/:friendId', protect, chatController.markAsRead);
router.post('/upload', protect, upload.single('file'), chatController.uploadMedia);
router.post('/fcm-token', protect, chatController.updateFCMToken);
router.delete('/clear/:friendId', protect, chatController.clearHistory);

module.exports = router;
