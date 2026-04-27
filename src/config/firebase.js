//src/config/firebase.js
const admin = require('firebase-admin');

try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
        console.warn("[FIREBASE] Attention: Variables d'environnement Firebase manquantes. Les notifications push ne fonctionneront pas.");
    } else {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
        });
        console.log("[FIREBASE] Admin SDK initialisé avec succès");
    }
} catch (error) {
    console.error("[FIREBASE] Erreur d'initialisation:", error);
}

module.exports = admin;
