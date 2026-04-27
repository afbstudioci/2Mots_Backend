const express = require('express');
const router = express.Router();
const missionController = require('../controllers/missionController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, missionController.getMissions);
router.post('/claim/:id', protect, missionController.claimReward);

module.exports = router;
