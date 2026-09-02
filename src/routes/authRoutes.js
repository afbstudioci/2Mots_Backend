// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/uploadMiddleware');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skipSuccessfulRequests: true,
    message: { status: 'error', message: 'Trop de tentatives infructueuses. Veuillez réessayer dans 15 minutes.' }
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleAuth);
router.post('/fcm-token', protect, authController.updateFcmToken);
router.put('/fcm-token', protect, authController.updateFcmToken);
router.delete('/fcm-token', protect, authController.removeFcmToken);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);

router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);
router.put('/me', protect, upload.single('avatar'), authController.updateProfile);
router.delete('/account', protect, authController.deleteAccount);

module.exports = router;