//src/routes/gameRoutes.js
const express = require('express');
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/words', gameController.getWords);
router.post('/validate', gameController.validateSession);

module.exports = router;