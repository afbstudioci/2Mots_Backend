const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const User = require('../models/User');

// Protection des routes par Access Token
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ status: 'fail', message: 'Accès non autorisé, token manquant' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        // Récupérer l'utilisateur sans son mot de passe (grâce à select: false)
        req.user = await User.findById(decoded.id);
        if (!req.user) {
            return res.status(401).json({ status: 'fail', message: 'Cet utilisateur n\'existe plus' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ status: 'fail', message: 'Token invalide ou expiré' });
    }
};

module.exports = { protect };