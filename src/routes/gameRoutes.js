//src/routes/gameRoutes.js
const express = require('express');
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

// On aligne les noms de routes pour préparer le Frontend
router.get('/batch', gameController.getBatch);
router.post('/validate', gameController.validateSession);

module.exports = router;