//src/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Cette route est publique car necessaire des le lancement ou pour la page contact
router.get('/', configController.getAppConfig);

module.exports = router;