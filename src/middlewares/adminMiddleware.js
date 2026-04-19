//src/middlewares/adminMiddleware.js
const User = require('../models/User');

exports.requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ status: 'fail', message: 'Non authentifié' });
        }

        const adminMail = process.env.ADMIN_MAIL;

        if (!adminMail) {
            console.error("[SÉCURITÉ] ADMIN_MAIL n'est pas défini dans les variables d'environnement.");
            return res.status(500).json({ status: 'error', message: 'Erreur de configuration serveur' });
        }

        // Vérification du rôle ou de l'email maître
        if (req.user.role !== 'superadmin' && req.user.email !== adminMail) {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'Accès refusé : Privilèges SuperAdmin requis' 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la vérification des droits' });
    }
};