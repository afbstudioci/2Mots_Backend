//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 50000;

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Clé API Gemini absente. Génération annulée.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    try {
        console.log(`[WORKER] Génération IA avec LOGIQUE PURE et MINIMALISTE (Modèle : ${geminiModel})...`);

        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        
        RÈGLE D'OR DE LA LOGIQUE (INTERDICTION DES CATÉGORIES) :
        Le lien entre les deux mots NE DOIT JAMAIS être une simple catégorie abstraite (comme "Météo", "Nature", "Outil").
        Le lien doit être le RÉSULTAT CONCRET, l'OBJET CRÉÉ, l'UTILISATION, ou l'ASSOCIATION DIRECTE.

        EXEMPLES DE BONNE LOGIQUE (À REPRODUIRE) :
        - Serrure + Clé = Porte
        - Abeille + Fleur = Miel
        - Vache + Herbe = Lait
        - Pluie + Soleil = Arc-en-ciel
        - Pinceau + Peinture = Tableau
        - Roue + Moteur = Voiture
        - Farine + Eau = Pain

        EXEMPLES DE MAUVAISE LOGIQUE (STRICTEMENT INTERDIT) :
        - Nuage + Pluie = Météo (Interdit car trop abstrait)
        - Chien + Chat = Animal (Interdit car c'est une catégorie)

        INSTRUCTIONS TECHNIQUES :
        1. "difficulty" : Évalue la difficulté logique de 1 à 10 (1 = Évident, 10 = Très complexe mais toujours logique).
        2. "expectedType" : Nature grammaticale (ex: "Nom commun", "Verbe").
        3. Matchs : Fournis "exactMatch", "closeMatch" (80%), et "partialMatch" (50%).
        
        Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
        Format attendu :
        [
          {
            "word1": "Abeille",
            "word2": "Fleur",
            "clue": "Produit sucré et doré",
            "expectedType": "Nom commun",
            "difficulty": 2,
            "exactMatch": ["miel"],
            "closeMatch": ["nectar"],
            "partialMatch": ["ruche"]
          }
        ]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        responseText = responseText.replace(/,\s*\]/g, ']'); 

        const parsedData = JSON.parse(responseText);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            await WordPair.insertMany(parsedData, { ordered: false });
            console.log(`[WORKER] Succès : ${parsedData.length} mots logiques injectés dans MongoDB.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la génération IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < DB_WORD_LIMIT) {
            console.log(`[WORKER] Base de données en croissance (${count}/${DB_WORD_LIMIT})...`);
            await generateAndSaveWords();
        } else {
            console.log(`[WORKER] Base de données suffisante (${count}/${DB_WORD_LIMIT}).`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur de vérification :', error.message);
    }
};

const initAiWorker = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Clé API Gemini absente.");
        return;
    }

    // Plus de script lourd de réparation d'icônes, on lance directement l'initialisation
    initializeWordDatabase();

    cron.schedule('0 * * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Générateur IA Logique Minimaliste armé.');
};

module.exports = initAiWorker;