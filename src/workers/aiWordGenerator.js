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
        console.log(`[WORKER] Génération IA avec LOGIQUE CAUSALE STRICTE (Modèle : ${geminiModel})...`);

        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        
        RÈGLE D'OR DE LA LOGIQUE STRICTE (INTERDICTION DES CATÉGORIES ET SYNONYMES) :
        Le lien entre les deux mots NE DOIT JAMAIS être une catégorie abstraite, un adjectif vague ou un synonyme d'un des mots.
        Il doit s'agir d'une CAUSALITÉ, d'un RÉSULTAT CONCRET, d'une ACTION DIRECTE ou d'une COMPOSITION PHYSIQUE incontestable.
        La solution ("exactMatch") ne doit en aucun cas être une variation de "word1" ou "word2".

        EXEMPLES DE BONNE LOGIQUE CAUSALE (À REPRODUIRE) :
        - Serrure + Clé = Porte
        - Abeille + Fleur = Miel
        - Vache + Herbe = Lait
        - Pluie + Soleil = Arc-en-ciel
        - Pinceau + Peinture = Tableau
        - Roue + Moteur = Voiture
        - Farine + Eau = Pain

        EXEMPLES DE MAUVAISE LOGIQUE (STRICTEMENT INTERDIT) :
        - Glace + Chaleur = Froid (Interdit: "Froid" est un adjectif abstrait lié à Glace)
        - Fenêtre + Verre = Transparence (Interdit: Concept abstrait sans résultat matériel)
        - Avocat + Plaider = Plaider (Interdit: La solution est l'un des mots)
        - Nuage + Pluie = Météo (Interdit: Catégorie vague)

        INSTRUCTIONS TECHNIQUES ET ORTHOGRAPHIQUES :
        1. "difficulty" : Évalue la difficulté logique de 1 à 10 (1 = Évident, 10 = Très complexe mais toujours parfaitement logique et matériel).
        2. "expectedType" : Nature grammaticale (ex: "Nom commun", "Verbe").
        3. Matchs : Fournis "exactMatch", "closeMatch" (80%), et "partialMatch" (50%).
        4. TYPOGRAPHIE PARFAITE : Tu dois fournir un texte avec tous les accents français corrects (é, è, à, ç, etc.). Fais très attention à ne pas oublier d'accents dans "clue", "word1", "word2" et les tableaux de match.
        
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

        responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
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

    initializeWordDatabase();

    cron.schedule('0 * * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Générateur IA Logique Causale Stricte armé.');
};

module.exports = initAiWorker;