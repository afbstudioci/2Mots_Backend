//src/config/firebase.js
const admin = require('firebase-admin');

try {
    if (!admin.apps.length) {
        let certConfig = null;

        // Option 1 : JSON complet du compte de service (100% infaillible sans erreur de copier-coller)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
                if (raw.startsWith('{')) {
                    certConfig = JSON.parse(raw);
                } else {
                    const decoded = Buffer.from(raw, 'base64').toString('utf8');
                    certConfig = JSON.parse(decoded);
                }
            } catch (err) {
                console.error('[FIREBASE] Erreur parsing JSON complet:', err.message);
            }
        }

        // Option 2 : Variables découpées individuelles
        if (!certConfig && process.env.FIREBASE_PRIVATE_KEY) {
            const rawKey = process.env.FIREBASE_PRIVATE_KEY;
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

            if (rawKey && projectId && clientEmail) {
                let key = String(rawKey)
                    .replace(/["']/g, '')
                    .replace(/\\n/g, '\n')
                    .replace(/\r/g, '')
                    .trim();

                if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) {
                    key = `-----BEGIN PRIVATE KEY-----\n${key}`;
                }
                if (!key.endsWith('-----END PRIVATE KEY-----')) {
                    key = `${key}\n-----END PRIVATE KEY-----\n`;
                }

                certConfig = {
                    projectId: projectId.trim(),
                    clientEmail: clientEmail.trim(),
                    privateKey: key,
                };
            }
        }

        if (certConfig) {
            admin.initializeApp({
                credential: admin.credential.cert(certConfig),
            });
            console.log('[FIREBASE] Admin SDK initialisé avec succès.');
        } else {
            console.warn("[FIREBASE] Attention: Variables d'environnement Firebase manquantes.");
        }
    }
} catch (error) {
    console.error('[FIREBASE] Erreur fatale initialisation:', error.message);
}

module.exports = admin;
