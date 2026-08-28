// src/config/firebase.js
// INITIALISATION FIREBASE ADMIN - Moteur Push
// STANDARD: Industriel / Bank Grade (Inspiré de Yély)

const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    let initialized = false;

    // MÉTHODE 1 : Via JSON Complet (si FIREBASE_SERVICE_ACCOUNT est défini dans Render)
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountRaw) {
      try {
        const raw = serviceAccountRaw.trim();
        const serviceAccount = raw.startsWith('{')
          ? JSON.parse(raw)
          : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));

        // NETTOYAGE ESSENTIEL DE LA CLÉ RSA (Anti-Invalid JWT Signature)
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/\r/g, '')
            .trim();
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        initialized = true;
        const activeProjectId = serviceAccount.project_id || 'non_spécifié';
        console.log(`[FIREBASE] Moteur Push initialisé avec succès (via Service Account JSON, Projet : ${activeProjectId})`);
      } catch (err) {
        console.warn('[FIREBASE] Avertissement parsing Service Account JSON, tentative avec variables individuelles...', err.message);
      }
    }

    // MÉTHODE 2 : Via Variables d'environnement individuelles (Standard Yély)
    if (!initialized) {
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!rawKey || !projectId || !clientEmail) {
        throw new Error("Variables d'environnement Firebase manquantes (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY).");
      }

      // NETTOYAGE ABSOLU (Anti-crash Render - Algorithme Yély) :
      // 1. Suppression de tous les guillemets superflus
      // 2. Suppression des retours chariot Windows (\r)
      // 3. Transformation des '\n' littéraux en véritables sauts de ligne système
      const cleanKey = rawKey
        .replace(/["']/g, '')
        .replace(/\r/g, '')
        .replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId.trim(),
          clientEmail: clientEmail.trim(),
          privateKey: cleanKey,
        }),
      });

      console.log(`[FIREBASE] Moteur Push initialisé avec succès (Projet : ${projectId.trim()})`);
    }
  }
} catch (error) {
  console.error('ERREUR FATALE: Impossible d\'initialiser Firebase !');
  console.error(error.message);
}

module.exports = admin;
