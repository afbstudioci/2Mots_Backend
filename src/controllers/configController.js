//src/controllers/configController.js

/**
 * Recupere la configuration publique de l'application (reseaux sociaux, contact)
 * On utilise des variables qui pourraient, plus tard, provenir de la base de donnees
 */
exports.getAppConfig = async (req, res) => {
    try {
        const config = {
            contact: {
                facebook: "https://facebook.com/ton-lien",
                whatsapp: "https://wa.me/ton-numero",
                phone: "+2250000000000",
                email: "contact@tondomaine.com"
            },
            links: {
                rules: "https://tonsite.com/regles",
                privacy: "https://tonsite.com/confidentialite"
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