const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey } = require('../config/env');

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Generation annulee.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    try {
        console.log('[WORKER] Demarrage de la generation de nouveaux mots...');

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
        // Les IA rajoutent souvent une virgule avant le crochet fermant, on la retire pour eviter l'erreur de parsing
        responseText = responseText.replace(/,\s*\]/g, ']'); 

        const parsedData = JSON.parse(responseText);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            // ordered: false permet d'ignorer les doublons et de sauvegarder ceux qui passent
            await WordPair.insertMany(parsedData, { ordered: false });
            console.log(`[WORKER] Succes : ${parsedData.length} nouveaux mots injectes dans MongoDB.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la generation IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < 50) {
            console.log(`[WORKER] Base de donnees faible (${count} mots). Lancement de l'amorce immediate...`);
            await generateAndSaveWords();
        } else {
            console.log(`[WORKER] Base de donnees suffisante (${count} mots).`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la verification de la base :', error.message);
    }
};

const initAiWorker = () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Generateur IA inactif.");
        return;
    }

    // 1. Amorce immediate si la base est vide au demarrage
    initializeWordDatabase();

    // 2. Planification recurrente (toutes les heures)
    cron.schedule('0 * * * *', async () => {
        await generateAndSaveWords();
    });

    console.log('[WORKER] Generateur IA arme et planifie.');
};

module.exports = initAiWorker;