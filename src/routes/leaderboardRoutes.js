//src/routes/leaderboardRoutes.js
const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// On protège cette route pour s'assurer que seuls les joueurs connectés puissent requêter le classement
router.get('/top', protect, leaderboardController.getTopPlayers);

module.exports = router;