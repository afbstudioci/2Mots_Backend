//src/routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');

// Route temporaire : la boutique n'est pas encore disponible
router.get('/', protect, (req, res) => {
    res.status(200).json({ status: 'success', data: [] });
});

module.exports = router;
