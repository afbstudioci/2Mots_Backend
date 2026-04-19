//src/routes/leaderboardRoutes.js
const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Route alignée sur l'appel du frontend api.get('/leaderboard')
// On utilise le nom correct de la fonction exportée par le contrôleur
router.get('/', protect, leaderboardController.getTopPlayers);

module.exports = router;