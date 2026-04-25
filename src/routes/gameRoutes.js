const express = require('express');
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

// Routes de jeu
router.get('/batch', gameController.getBatch);
router.post('/check', gameController.checkAnswer); // Nouvelle route temps réel
router.post('/validate', gameController.validateSession);

module.exports = router;