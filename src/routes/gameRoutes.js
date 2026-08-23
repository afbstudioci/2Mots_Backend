//src/routes/gameRoutes.js
const express = require('express');
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/batch', gameController.getBatch);
router.post('/check', gameController.checkAnswer);
router.post('/use-hint', gameController.useHint);
router.post('/validate', gameController.validateSession);
router.post('/end', gameController.validateSession);
router.post('/chest-opened', gameController.claimChest);
router.post('/sync-keys', gameController.syncKeys);
router.post('/sync-offline', gameController.syncOffline);

module.exports = router;