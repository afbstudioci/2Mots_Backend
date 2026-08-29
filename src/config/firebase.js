// src/config/firebase.js
// INITIALISATION FIREBASE ADMIN - Moteur Push
// STANDARD: Industriel / Bank Grade (Inspire de Yely)

const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    let initialized = false;

    // METHODE 1 : Via JSON Complet (si FIREBASE_SERVICE_ACCOUNT est defini dans Render)
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountRaw) {
      try {
        const raw = serviceAccountRaw.trim();
        const serviceAccount = raw.startsWith('{')
          ? JSON.parse(raw)
          : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));

        // NETTOYAGE ESSENTIEL DE LA CLE RSA (Anti-Invalid JWT Signature)
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
        const activeProjectId = serviceAccount.project_id || 'non_specifie';
        console.log(`[FIREBASE] Moteur Push initialise avec succes (via Service Account JSON, Projet : ${activeProjectId})`);
      } catch (err) {
        console.warn('[FIREBASE] Avertissement parsing Service Account JSON, tentative avec variables individuelles...', err.message);
      }
    }

    // METHODE 2 : Via Variables d'environnement individuelles (Standard Yely)
    if (!initialized) {
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!rawKey || !projectId || !clientEmail) {
        throw new Error("Variables d'environnement Firebase manquantes (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY).");
      }

      // NETTOYAGE ABSOLU (Anti-crash Render - Algorithme Yely) :
      // 1. Suppression de tous les guillemets superflus
      // 2. Suppression des retours chariot Windows (\r)
      // 3. Transformation des '\n' litteraux en veritables sauts de ligne systeme
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

      console.log(`[FIREBASE] Moteur Push initialise avec succes (Projet : ${projectId.trim()})`);
    }
  }
} catch (error) {
  console.error('ERREUR FATALE: Impossible d\'initialiser Firebase !');
  console.error(error.message);
}

module.exports = admin;
