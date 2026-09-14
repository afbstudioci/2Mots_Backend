//src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ status: 'fail', message: 'Accès non autorisé, jeton manquant.' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = await User.findById(decoded.id);

        if (!req.user) {
            return res.status(401).json({ status: 'fail', message: 'Cet utilisateur n\'existe plus.' });
        }

        // Suivi de l'activité et attribution du cadeau de retour sans bloquer la requête
        const lastActive = req.user.lastActiveAt ? new Date(req.user.lastActiveAt).getTime() : 0;
        const shouldUpdateActivity = (Date.now() - lastActive > 15 * 60 * 1000) || req.user.inactivityReminderStage > 0 || req.user.returnGiftClaimable;

        if (shouldUpdateActivity) {
            const retentionService = require('../services/retentionService');
            retentionService.trackUserActivity(req.user._id).catch(() => {});
        }

        next();
    } catch (error) {
        return res.status(401).json({ status: 'fail', message: 'Jeton invalide ou expiré.' });
    }
};

module.exports = { protect };