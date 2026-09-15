// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/uploadMiddleware');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { status: 'error', message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.' }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { status: 'error', message: 'Trop de demandes. Veuillez patienter 1 minute avant de réessayer.' }
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleAuth);
router.post('/fcm-token', protect, authController.updateFcmToken);
router.put('/fcm-token', protect, authController.updateFcmToken);
router.delete('/fcm-token', protect, authController.removeFcmToken);
router.post('/push-token', protect, authController.updateFcmToken);
router.put('/push-token', protect, authController.updateFcmToken);
router.delete('/push-token', protect, authController.removeFcmToken);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);
router.put('/me', protect, upload.single('avatar'), authController.updateProfile);
router.delete('/account', protect, authController.deleteAccount);

module.exports = router;