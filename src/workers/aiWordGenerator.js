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
        
        RÈGLE D'OR DE LA LOGIQUE STRICTE :
        Le lien entre les deux mots NE DOIT JAMAIS être une catégorie abstraite ou un synonyme d'un des mots.
        Il doit s'agir d'une CAUSALITÉ, d'un RÉSULTAT CONCRET ou d'une ACTION DIRECTE incontestable.
        La nature du mot attendu ("expectedType") peut être un Nom commun, un Verbe, ou un Adjectif, tant que la logique est pure et rigoureuse.
        La solution ("exactMatch") ne doit en aucun cas être une variation de "word1" ou "word2".

        EXEMPLES DE BONNE LOGIQUE CAUSALE (À REPRODUIRE) :
        - Serrure + Clé = Ouvrir (Verbe)
        - Glace + Soleil = Fondre (Verbe) ou Eau (Nom commun)
        - Abeille + Fleur = Butiner (Verbe) ou Miel (Nom commun)
        - Pluie + Froid = Geler (Verbe) ou Verglas (Nom commun)
        - Citron + Vinaigre = Acide (Adjectif)

        EXEMPLES DE MAUVAISE LOGIQUE (STRICTEMENT INTERDIT) :
        - Glace + Chaleur = Froid (Interdit: "Froid" est juste le contraire de chaleur, ce n'est pas le résultat causal)
        - Fenêtre + Verre = Transparence (Interdit: Concept trop abstrait)
        - Avocat + Plaider = Plaider (Interdit: La solution est l'un des mots)

        INSTRUCTIONS TECHNIQUES ET ORTHOGRAPHIQUES :
        1. "difficulty" : Évalue la difficulté logique de 1 à 10 (1 = Évident, 10 = Très complexe mais toujours parfaitement logique).
        2. "expectedType" : Nature grammaticale (ex: "Nom commun", "Verbe", "Adjectif").
        3. Matchs : Fournis "exactMatch", "closeMatch" (80%), et "partialMatch" (50%).
        4. TYPOGRAPHIE PARFAITE : Tu dois fournir un texte avec tous les accents français corrects (é, è, à, ç, etc.). Fais très attention à ne pas oublier d'accents.
        
        Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
        Format attendu :
        [
          {
            "word1": "Abeille",
            "word2": "Fleur",
            "clue": "Action de récolter le nectar",
            "expectedType": "Verbe",
            "difficulty": 2,
            "exactMatch": ["butiner"],
            "closeMatch": ["recolter"],
            "partialMatch": ["manger"]
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