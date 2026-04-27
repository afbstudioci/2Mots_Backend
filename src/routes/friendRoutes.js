//src/routes/friendRoutes.js
const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, friendController.getFriends);
router.get('/requests', protect, friendController.getRequests);
router.post('/request/:id', protect, friendController.sendRequest);
router.post('/accept/:id', protect, friendController.acceptRequest);
router.get('/search', protect, friendController.search);

module.exports = router;
