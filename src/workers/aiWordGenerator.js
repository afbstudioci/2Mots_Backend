//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 50000;

// Nouveau dictionnaire 100% Ionicons (Strictement vérifié et garanti sans erreurs)
const CATEGORY_ICON_MAP = {
  "Alimentation": "Ionicons:restaurant-outline",
  "Nature": "Ionicons:leaf-outline",
  "Animal": "Ionicons:paw-outline",
  "Transport": "Ionicons:car-outline",
  "Météo": "Ionicons:partly-sunny-outline",
  "Corps": "Ionicons:body-outline",
  "Vêtement": "Ionicons:shirt-outline",
  "Outil": "Ionicons:build-outline",
  "Émotion": "Ionicons:happy-outline",
  "Sport": "Ionicons:football-outline",
  "Science": "Ionicons:flask-outline",
  "Musique": "Ionicons:musical-notes-outline",
  "Bâtiment": "Ionicons:business-outline",
  "Mobilier": "Ionicons:bed-outline",
  "Couleur": "Ionicons:color-palette-outline",
  "Temps": "Ionicons:time-outline",
  "Lumière": "Ionicons:sunny-outline",
  "Eau": "Ionicons:water-outline",
  "Feu": "Ionicons:flame-outline",
  "Terre": "Ionicons:earth-outline",
  "Ciel": "Ionicons:cloud-outline",
  "Objet": "Ionicons:cube-outline",
  "Personne": "Ionicons:person-outline",
  "Lieu": "Ionicons:location-outline",
  "Action": "Ionicons:walk-outline",
  "Default": "Ionicons:help-circle-outline"
};

// Dictionnaire de traduction pour réparer les anciennes erreurs de la base de données
const REPAIR_MAP = {
  "MaterialCommunityIcons:food-apple": "Ionicons:restaurant-outline",
  "Feather:leaf": "Ionicons:leaf-outline",
  "MaterialCommunityIcons:cat": "Ionicons:paw-outline",
  "FontAwesome5:car": "Ionicons:car-outline",
  "MaterialCommunityIcons:weather-partly-cloudy": "Ionicons:partly-sunny-outline",
  "FontAwesome5:hand-paper": "Ionicons:body-outline",
  "MaterialCommunityIcons:tshirt-crew": "Ionicons:shirt-outline",
  "Ionicons:build": "Ionicons:build-outline",
  "MaterialCommunityIcons:emoticon-happy": "Ionicons:happy-outline",
  "MaterialCommunityIcons:soccer": "Ionicons:football-outline",
  "MaterialCommunityIcons:atom": "Ionicons:flask-outline",
  "FontAwesome5:music": "Ionicons:musical-notes-outline",
  "Ionicons:business": "Ionicons:business-outline",
  "MaterialCommunityIcons:sofa": "Ionicons:bed-outline",
  "MaterialCommunityIcons:palette": "Ionicons:color-palette-outline",
  "Ionicons:time": "Ionicons:time-outline",
  "Feather:sun": "Ionicons:sunny-outline",
  "Ionicons:water": "Ionicons:water-outline",
  "MaterialCommunityIcons:fire": "Ionicons:flame-outline",
  "MaterialCommunityIcons:terrain": "Ionicons:earth-outline",
  "Feather:cloud": "Ionicons:cloud-outline",
  "Feather:box": "Ionicons:cube-outline",
  "Ionicons:person": "Ionicons:person-outline",
  "Ionicons:location": "Ionicons:location-outline",
  "MaterialCommunityIcons:run": "Ionicons:walk-outline"
};

const VALID_CATEGORIES = Object.keys(CATEGORY_ICON_MAP).filter(k => k !== "Default").join(', ');

// Fonction d'auto-guérison de la base de données
const repairDatabaseIcons = async () => {
    try {
        console.log("[WORKER] Début de l'analyse et réparation des icônes corrompues...");
        const pairs = await WordPair.find({});
        let repairedCount = 0;

        for (let pair of pairs) {
            let needsSave = false;

            // Remplacement via la table de conversion ou assignation par défaut
            if (pair.icon1 && REPAIR_MAP[pair.icon1]) {
                pair.icon1 = REPAIR_MAP[pair.icon1];
                needsSave = true;
            } else if (pair.icon1 && !pair.icon1.startsWith('Ionicons:')) {
                pair.icon1 = "Ionicons:help-circle-outline";
                needsSave = true;
            }

            if (pair.icon2 && REPAIR_MAP[pair.icon2]) {
                pair.icon2 = REPAIR_MAP[pair.icon2];
                needsSave = true;
            } else if (pair.icon2 && !pair.icon2.startsWith('Ionicons:')) {
                pair.icon2 = "Ionicons:help-circle-outline";
                needsSave = true;
            }

            if (needsSave) {
                await pair.save();
                repairedCount++;
            }
        }

        if (repairedCount > 0) {
            console.log(`[WORKER] Succès de la réparation : ${repairedCount} énigmes ont été nettoyées.`);
        } else {
            console.log("[WORKER] Base de données saine. Aucune icône corrompue détectée.");
        }
    } catch (error) {
        console.error('[WORKER] Erreur critique lors de la réparation de la base :', error.message);
    }
};

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Clé API Gemini absente. Génération annulée.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    try {
        console.log(`[WORKER] Démarrage de la génération de nouveaux mots avec le modèle : ${geminiModel}...`);

        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        Tu dois fournir la nature grammaticale dans "expectedType" (ex: "Nom commun", "Verbe", "Adjectif").
        Tu dois classer chaque mot dans la catégorie la plus pertinente parmi cette liste EXACTE : [${VALID_CATEGORIES}]. Mets la catégorie dans "category1" et "category2".
        Tu dois fournir les réponses acceptées dans 3 catégories :
        - exactMatch : La réponse parfaite.
        - closeMatch : Synonymes très proches (80% de précision).
        - partialMatch : Concept lié (50% de précision).
        
        INTERDICTION ABSOLUE D'UTILISER DES EMOJIS.
        Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
        Format attendu :
        [
          {
            "word1": "Océan",
            "category1": "Eau",
            "word2": "Ciel",
            "category2": "Météo",
            "clue": "Couleur dominante",
            "expectedType": "Adjectif",
            "exactMatch": ["bleu"],
            "closeMatch": ["bleuté", "azur"],
            "partialMatch": ["cyan", "couleur"]
          }
        ]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        responseText = responseText.replace(/,\s*\]/g, ']'); 

        const parsedData = JSON.parse(responseText);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            const finalData = parsedData.map(item => {
                const icon1 = CATEGORY_ICON_MAP[item.category1] || CATEGORY_ICON_MAP["Default"];
                const icon2 = CATEGORY_ICON_MAP[item.category2] || CATEGORY_ICON_MAP["Default"];
                
                const { category1, category2, ...rest } = item;
                return { ...rest, icon1, icon2 };
            });

            await WordPair.insertMany(finalData, { ordered: false });
            console.log(`[WORKER] Succès : ${finalData.length} nouveaux mots injectés dans MongoDB.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la génération IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < DB_WORD_LIMIT) {
            console.log(`[WORKER] Base de données en croissance (${count}/${DB_WORD_LIMIT}). Lancement de l'amorce...`);
            await generateAndSaveWords();
        } else {
            console.log(`[WORKER] Base de données suffisante (${count}/${DB_WORD_LIMIT}). Génération annulée.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la vérification de la base :', error.message);
    }
};

const initAiWorker = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Clé API Gemini absente. Générateur IA inactif.");
        return;
    }

    // 1. On nettoie les erreurs passées avant toute chose
    await repairDatabaseIcons();

    // 2. On lance la vérification pour générer si besoin
    initializeWordDatabase();

    // 3. On programme la tâche cron toutes les heures
    cron.schedule('0 * * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Générateur IA armé et sécurisé.');
};

module.exports = initAiWorker;