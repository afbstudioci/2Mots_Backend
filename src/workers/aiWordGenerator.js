//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Génération annulée.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    // Utilisation du modèle défini dynamiquement via les variables d'environnement
    const model = genAI.getGenerativeModel({ model: geminiModel });

    try {
        console.log(`[WORKER] Démarrage de la génération avec le modèle : ${geminiModel}...`);

        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        Tu dois fournir la nature grammaticale dans "expectedType" (ex: "Nom commun", "Verbe", "Adjectif").
        Tu dois fournir les réponses acceptées dans 3 catégories :
        - exactMatch : La réponse parfaite.
        - closeMatch : Synonymes très proches (80% de précision).
        - partialMatch : Concept lié (50% de précision).
        
        Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
        Format attendu :
        [
          {
            "word1": "Océan",
            "word2": "Ciel",
            "clue": "Couleur dominante",
            "expectedType": "Adjectif",
            "exactMatch": ["bleu"],
            "closeMatch": ["bleuté", "azur"],
            "partialMatch": ["cyan", "couleur"]
          }
        ]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        // Nettoyage robuste du JSON renvoyé par l'IA
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        // Correction automatique des erreurs fréquentes de syntaxe JSON des IA
        responseText = responseText.replace(/,\s*\]/g, ']'); 

        const parsedData = JSON.parse(responseText);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            // ordered: false permet d'ignorer les doublons et de sauvegarder ceux qui passent
            await WordPair.insertMany(parsedData, { ordered: false });
            console.log(`[WORKER] Succès : ${parsedData.length} nouveaux mots injectés dans MongoDB.`);
        }
    } catch (error) {
        console.error(`[WORKER] Erreur lors de la génération avec ${geminiModel} :`, error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < 50) {
            console.log(`[WORKER] Base de données faible (${count} mots). Lancement de l'amorce immédiate...`);
            await generateAndSaveWords();
        } else {
            console.log(`[WORKER] Base de données suffisante (${count} mots).`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la vérification de la base :', error.message);
    }
};

const initAiWorker = () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Générateur IA inactif.");
        return;
    }

    // Amorce immédiate au démarrage
    initializeWordDatabase();

    // Planification toutes les heures
    cron.schedule('0 * * * *', async () => {
        await generateAndSaveWords();
    });

    console.log(`[WORKER] Générateur IA armé (Modèle: ${geminiModel}) et planifié.`);
};

module.exports = initAiWorker;