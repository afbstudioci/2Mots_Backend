//src/controllers/configController.js

/**
 * Recupere la configuration publique de l'application (reseaux sociaux, contact, liens)
 * Les donnees proviennent des variables d'environnement pour une securite et modularite maximales.
 */
exports.getAppConfig = async (req, res) => {
    try {
        const config = {
            contact: {
                facebook: process.env.CONTACT_FACEBOOK || "https://facebook.com",
                whatsapp: process.env.CONTACT_WHATSAPP || "https://wa.me/0000000000",
                phone: process.env.CONTACT_PHONE || "+2250000000000",
                email: process.env.CONTACT_EMAIL || "contact@2mots.com"
            },
            links: {
                rules: process.env.LINK_RULES || "https://2mots.com/regles",
                privacy: process.env.LINK_PRIVACY || "https://2mots.com/confidentialite"
            }
        };

        res.status(200).json({
            status: 'success',
            data: config
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la recuperation de la configuration'
        });
    }
};