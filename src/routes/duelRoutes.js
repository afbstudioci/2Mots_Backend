//src/routes/duelRoutes.js
const express = require('express');
const router = express.Router();
const duelController = require('../controllers/duelController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/opponents', duelController.getEligibleOpponents);
router.get('/invites', duelController.getPendingInvites);
router.post('/invite', duelController.createInvite);
router.post('/respond', duelController.respondInvite);
router.get('/:id', duelController.getDuelDetails);

module.exports = router;
