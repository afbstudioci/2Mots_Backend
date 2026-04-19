//src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middlewares/validators');
const { protect } = require('../middlewares/auth');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);

// Routes nécessitant une authentification
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

module.exports = router;