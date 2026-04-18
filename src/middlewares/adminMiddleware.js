//src/middlewares/adminMiddleware.js
const User = require('../models/User');

exports.requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ status: 'fail', message: 'Non authentifie' });
        }

        const adminMail = process.env.ADMIN_MAIL;

        if (!adminMail) {
            console.error("[Securite] ADMIN_MAIL n'est pas defini dans les variables d'environnement.");
            return res.status(500).json({ status: 'error', message: 'Erreur de configuration serveur' });
        }

        // On verifie si l'utilisateur a le role superadmin OU si son email correspond a la variable maitresse
        if (req.user.role !== 'superadmin' && req.user.email !== adminMail) {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'Acces refuse : Privileges SuperAdmin requis' 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la verification des droits' });
    }
};