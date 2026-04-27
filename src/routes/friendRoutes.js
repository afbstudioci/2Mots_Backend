//src/routes/friendRoutes.js
const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, friendController.getFriends);
router.get('/requests', protect, friendController.getRequests);
router.get('/sent', protect, friendController.getSentRequests);
router.post('/request/:id', protect, friendController.sendRequest);
router.post('/accept/:id', protect, friendController.acceptRequest);
router.get('/search', protect, friendController.search);

module.exports = router;
