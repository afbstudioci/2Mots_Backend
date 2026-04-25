//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 50000;

const REPAIR_MAP = {
  "Ionicons:restaurant-outline": "\u{1F37D}",
  "Ionicons:leaf-outline": "\u{1F343}",
  "Ionicons:paw-outline": "\u{1F43E}",
  "Ionicons:car-outline": "\u{1F697}",
  "Ionicons:partly-sunny-outline": "\u{26C5}",
  "Ionicons:body-outline": "\u{1F9CD}",
  "Ionicons:shirt-outline": "\u{1F455}",
  "Ionicons:build-outline": "\u{1F528}",
  "Ionicons:happy-outline": "\u{1F60A}",
  "Ionicons:football-outline": "\u{26BD}",
  "Ionicons:flask-outline": "\u{2697}",
  "Ionicons:musical-notes-outline": "\u{1F3B6}",
  "Ionicons:business-outline": "\u{1F3E2}",
  "Ionicons:bed-outline": "\u{1F6CF}",
  "Ionicons:color-palette-outline": "\u{1F3A8}",
  "Ionicons:time-outline": "\u{23F2}",
  "Ionicons:sunny-outline": "\u{2600}",
  "Ionicons:water-outline": "\u{1F4A7}",
  "Ionicons:flame-outline": "\u{1F525}",
  "Ionicons:earth-outline": "\u{1F30D}",
  "Ionicons:cloud-outline": "\u{2601}",
  "Ionicons:cube-outline": "\u{1F4E6}",
  "Ionicons:person-outline": "\u{1F464}",
  "Ionicons:location-outline": "\u{1F4CD}",
  "Ionicons:walk-outline": "\u{1F6B6}",
  "Ionicons:help-circle-outline": "\u{2753}",
  "MaterialCommunityIcons:food-apple": "\u{1F34E}",
  "Feather:leaf": "\u{1F343}",
  "MaterialCommunityIcons:cat": "\u{1F408}",
  "FontAwesome5:car": "\u{1F697}",
  "MaterialCommunityIcons:weather-partly-cloudy": "\u{26C5}",
  "FontAwesome5:hand-paper": "\u{270B}",
  "MaterialCommunityIcons:tshirt-crew": "\u{1F455}",
  "Ionicons:build": "\u{1F528}",
  "MaterialCommunityIcons:emoticon-happy": "\u{1F60A}",
  "MaterialCommunityIcons:soccer": "\u{26BD}",
  "MaterialCommunityIcons:atom": "\u{269B}",
  "FontAwesome5:music": "\u{1F3B6}",
  "Ionicons:business": "\u{1F3E2}",
  "MaterialCommunityIcons:sofa": "\u{1F6CB}",
  "MaterialCommunityIcons:palette": "\u{1F3A8}",
  "Ionicons:time": "\u{23F2}",
  "Feather:sun": "\u{2600}",
  "Ionicons:water": "\u{1F4A7}",
  "MaterialCommunityIcons:fire": "\u{1F525}",
  "MaterialCommunityIcons:terrain": "\u{1F3D4}",
  "Feather:cloud": "\u{2601}",
  "Feather:box": "\u{1F4E6}",
  "Ionicons:person": "\u{1F464}",
  "Ionicons:location": "\u{1F4CD}",
  "MaterialCommunityIcons:run": "\u{1F3C3}"
};

const repairDatabaseIcons = async () => {
    try {
        console.log("[WORKER] Migration massive vers le format Emoji Premium en cours...");
        const pairs = await WordPair.find({});
        let repairedCount = 0;

        for (let pair of pairs) {
            let needsSave = false;

            if (pair.icon1 && (pair.icon1.includes(':') || pair.icon1.includes('/'))) {
                pair.icon1 = REPAIR_MAP[pair.icon1] || "\u{2753}";
                needsSave = true;
            }
            if (pair.icon2 && (pair.icon2.includes(':') || pair.icon2.includes('/'))) {
                pair.icon2 = REPAIR_MAP[pair.icon2] || "\u{2753}";
                needsSave = true;
            }
            
            if (pair.difficulty === undefined || pair.difficulty > 10) {
                pair.difficulty = 1;
                needsSave = true;
            }

            if (needsSave) {
                await pair.save();
                repairedCount++;
            }
        }

        if (repairedCount > 0) {
            console.log(`[WORKER] Migration terminée : ${repairedCount} énigmes converties et sécurisées.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la migration :', error.message);
    }
};

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Génération annulée.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    try {
        console.log(`[WORKER] Génération IA avec difficulté dynamique (Modèle : ${geminiModel})...`);

        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        
        INSTRUCTIONS STRICTES :
        1. "icon1" et "icon2" : Fournis UNIQUEMENT un seul emoji (caractère Unicode natif) ultra-représentatif pour chaque mot.
        2. "difficulty" : Évalue la difficulté logique de 1 à 10. 
           - Niveau 1 : Évident et visuel (ex: Serrure + Clé = Porte).
           - Niveau 5 : Réflexion moyenne.
           - Niveau 10 : Très abstrait et complexe.
        3. "expectedType" : Nature grammaticale (ex: "Nom commun", "Verbe").
        4. Matchs : Fournis "exactMatch", "closeMatch" (80%), et "partialMatch" (50%).
        
        Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
        Format attendu :
        [
          {
            "word1": "Serrure",
            "icon1": "\u{1F512}",
            "word2": "Clé",
            "icon2": "\u{1F511}",
            "clue": "On l'ouvre pour entrer",
            "expectedType": "Nom commun",
            "difficulty": 1,
            "exactMatch": ["porte"],
            "closeMatch": ["portail"],
            "partialMatch": ["maison"]
          }
        ]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        responseText = responseText.replace(/,\s*\]/g, ']'); 

        const parsedData = JSON.parse(responseText);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            await WordPair.insertMany(parsedData, { ordered: false });
            console.log(`[WORKER] Succès : ${parsedData.length} nouveaux mots injectés dans MongoDB.`);
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
            console.log(`[WORKER] Base de données suffisante.`);
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

    await repairDatabaseIcons();
    initializeWordDatabase();

    cron.schedule('0 * * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Générateur IA avec Matchmaking armé.');
};

module.exports = initAiWorker;