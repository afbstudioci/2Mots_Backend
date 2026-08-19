//src/routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const shopController = require('../controllers/shopController');

router.get('/catalog', protect, shopController.getCatalog);
router.post('/buy-with-kevs', protect, shopController.buyWithKevs);
router.post('/verify-purchase', protect, shopController.verifyPurchase);
router.post('/use-booster', protect, shopController.useBooster);
router.post('/equip-cosmetic', protect, shopController.equipCosmetic);

module.exports = router;