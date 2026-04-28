//src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/uploadMiddleware');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { status: 'error', message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.' }
});

// Les routes appellent directement le contrôleur, plus de middleware de validation source de bugs
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);

router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

router.put('/me', protect, upload.single('avatar'), authController.updateProfile);

module.exports = router;