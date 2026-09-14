// src/routes/adRewardRoutes.js
// ROUTES DE GESTION DES RECOMPENSES PUBLICITAIRES ADMOB
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const express = require('express');
const adRewardController = require('../controllers/adRewardController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/shop-status', adRewardController.getShopStatus);
router.post('/claim-shop', adRewardController.claimShop);
router.post('/claim-second-chance', adRewardController.claimSecondChance);
router.post('/claim-double-kevs', adRewardController.claimDoubleKevs);
router.post('/claim-emergency-booster', adRewardController.claimEmergencyBooster);

module.exports = router;
