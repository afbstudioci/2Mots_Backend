// src/config/firebase.js
// INITIALISATION FIREBASE ADMIN - Moteur Push
// STANDARD: Industriel / Bank Grade

const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    let initialized = false;

    // METHODE 1 : Via JSON Complet (FIREBASE_SERVICE_ACCOUNT sur Render)
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
        console.log(`[FIREBASE] Initialise via Service Account JSON (Projet : ${activeProjectId})`);
        console.log(`[FIREBASE] apps.length = ${admin.apps.length}`);
      } catch (err) {
        console.error('[FIREBASE] ECHEC parsing Service Account JSON:', err.message);
      }
    }

    // METHODE 2 : Via Variables d'environnement individuelles
    if (!initialized) {
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!rawKey || !projectId || !clientEmail) {
        throw new Error(
          'Variables Firebase manquantes : FIREBASE_PROJECT_ID=' + !!projectId +
          ' FIREBASE_CLIENT_EMAIL=' + !!clientEmail +
          ' FIREBASE_PRIVATE_KEY=' + !!rawKey
        );
      }

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

      initialized = true;
      console.log(`[FIREBASE] Initialise via variables individuelles (Projet : ${projectId.trim()})`);
      console.log(`[FIREBASE] apps.length = ${admin.apps.length}`);
    }
  } else {
    console.log(`[FIREBASE] Deja initialise (apps.length = ${admin.apps.length})`);
  }
} catch (error) {
  console.error('[FIREBASE] ERREUR FATALE - Firebase ne sera PAS disponible !');
  console.error('[FIREBASE] Raison:', error.message);
}

// Diagnostic final : indiquer clairement si Firebase est disponible ou non
if (admin.apps.length > 0) {
  console.log('[FIREBASE] Statut : ACTIF - Push FCM disponible');
} else {
  console.error('[FIREBASE] Statut : INACTIF - Les push FCM seront silencieusement ignores !');
}

module.exports = admin;
