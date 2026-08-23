//src/controllers/configController.js

/**
 * Recupere la configuration publique de l'application (versioning, contact, liens)
 */
exports.getAppConfig = async (req, res) => {
    try {
        const config = {
            versioning: {
                latestVersionCode: parseInt(process.env.LATEST_VERSION_CODE, 10) || 15,
                minVersionCode: parseInt(process.env.MIN_VERSION_CODE, 10) || 1,
                latestVersionName: process.env.LATEST_VERSION_NAME || "1.0.0",
                forceUpdate: process.env.FORCE_UPDATE === 'true',
                updateTitle: process.env.UPDATE_TITLE || "Mise à jour disponible",
                updateMessage: process.env.UPDATE_MESSAGE || "Une nouvelle version de votre application est disponible. Elle contient des améliorations importantes.",
                storeUrl: "https://play.google.com/store/apps/details?id=com.afbstudio.twomots"
            },
            contact: {
                facebook: process.env.CONTACT_FACEBOOK || "https://facebook.com",
                whatsapp: process.env.CONTACT_WHATSAPP || "https://wa.me/0000000000",
                phone: process.env.CONTACT_PHONE || "+2250000000000",
                email: process.env.CONTACT_EMAIL || "afbstudio@gmail.com"
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