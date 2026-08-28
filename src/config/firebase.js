//src/config/firebase.js
const admin = require('firebase-admin');

const formatPrivateKey = (key) => {
    if (!key) return '';
    let formatted = String(key)
        .replace(/["']/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
        .trim();

    if (!formatted.startsWith('-----BEGIN PRIVATE KEY-----')) {
        formatted = `-----BEGIN PRIVATE KEY-----\n${formatted}`;
    }
    if (!formatted.endsWith('-----END PRIVATE KEY-----')) {
        formatted = `${formatted}\n-----END PRIVATE KEY-----\n`;
    }
    return formatted;
};

try {
    if (!admin.apps.length) {
        const rawKey = process.env.FIREBASE_PRIVATE_KEY;
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!rawKey || !projectId || !clientEmail) {
            console.warn("[FIREBASE] Attention: Variables d'environnement Firebase manquantes.");
        } else {
            const privateKey = formatPrivateKey(rawKey);

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectId.trim(),
                    clientEmail: clientEmail.trim(),
                    privateKey,
                }),
            });
            console.log('[FIREBASE] Admin SDK initialisé avec succès.');
        }
    }
} catch (error) {
    console.error('[FIREBASE] Erreur fatale initialisation:', error.message);
}

module.exports = admin;
