//src/config/firebase.js
const admin = require('firebase-admin');

try {
    if (!admin.apps.length) {
        const rawKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!rawKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
            console.warn("[FIREBASE] Attention: Variables d'environnement Firebase manquantes.");
        } else {
            // Nettoyage anti-crash Render : suppression des guillemets enveloppants et normalisation des retours à la ligne
            const cleanKey = rawKey
                .replace(/["']/g, '')
                .replace(/\\n/g, '\n');

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: cleanKey,
                }),
            });
            console.log('[FIREBASE] Admin SDK initialisé avec succès.');
        }
    }
} catch (error) {
    console.error('[FIREBASE] Erreur fatale initialisation:', error.message);
}

module.exports = admin;
