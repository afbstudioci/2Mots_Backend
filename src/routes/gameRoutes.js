const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/auth');
const { validateSubmitAnswer } = require('../middlewares/validators');

// Toutes les routes du jeu nécessitent d'être authentifié (sécurité anti-triche)
router.get('/batch', protect, gameController.getGameBatch);
router.post('/submit', protect, validateSubmitAnswer, gameController.submitAnswer);
router.post('/score', protect, gameController.updateBestScore);

module.exports = router;