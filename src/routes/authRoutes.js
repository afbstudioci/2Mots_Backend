const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middlewares/validators');
const { protect } = require('../middlewares/auth');

// Limiteur strict : uniquement pour proteger l'authentification (10 tentatives)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { status: 'error', message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.' }
});

// On place le limiteur strict avant les validateurs sur les routes sensibles
router.post('/register', authLimiter, validateRegister, authController.register);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);

// Routes nécessitant une authentification
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

module.exports = router;