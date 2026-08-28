//src/config/firebase.js
const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Option 1 : JSON complet si renseigné
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        const serviceAccount = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('[FIREBASE] Admin SDK initialisé avec succès via service account JSON');
        return;
      } catch (err) {
        console.warn('[FIREBASE] Fallback vers variables individuelles...');
      }
    }

    // Option 2 : Variables d'environnement standard
    if (!privateKey || !projectId || !clientEmail) {
      console.warn("[FIREBASE] Variables d'environnement Firebase manquantes.");
    } else {
      // 1. On retire les guillemets éventuels
      // 2. On retire les retours chariot Windows \r
      // 3. On transforme TOUTES les occurrences de '\n' en véritables retours chariot
      const cleanPrivateKey = privateKey
        .replace(/^["']|["']$/g, '')
        .replace(/\r/g, '')
        .replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId.trim(),
          clientEmail: clientEmail.trim(),
          privateKey: cleanPrivateKey,
        }),
      });

      console.log('[FIREBASE] Admin SDK initialisé avec succès');
    }
  }
} catch (error) {
  console.error('[FIREBASE] Erreur fatale initialisation:', error.message);
}

module.exports = admin;
