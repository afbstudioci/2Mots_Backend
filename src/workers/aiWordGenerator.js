const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey } = require('../config/env');

const DB_WORD_LIMIT = 50000;

// LE DICTIONNAIRE INFAILLIBLE : Catégorie -> Famille:NomIcone
const CATEGORY_ICON_MAP = {
  "Alimentation": "MaterialCommunityIcons:food-apple",
  "Nature": "Feather:leaf",
  "Animal": "MaterialCommunityIcons:cat",
  "Transport": "FontAwesome5:car",
  "Météo": "MaterialCommunityIcons:weather-partly-cloudy",
  "Corps": "FontAwesome5:hand-paper",
  "Vêtement": "MaterialCommunityIcons:tshirt-crew",
  "Outil": "Ionicons:build",
  "Émotion": "MaterialCommunityIcons:emoticon-happy",
  "Sport": "MaterialCommunityIcons:soccer",
  "Science": "MaterialCommunityIcons:atom",
  "Musique": "FontAwesome5:music",
  "Bâtiment": "Ionicons:business",
  "Mobilier": "MaterialCommunityIcons:sofa",
  "Couleur": "MaterialCommunityIcons:palette",
  "Temps": "Ionicons:time",
  "Lumière": "Feather:sun",
  "Eau": "Ionicons:water",
  "Feu": "MaterialCommunityIcons:fire",
  "Terre": "MaterialCommunityIcons:terrain",
  "Ciel": "Feather:cloud",
  "Objet": "Feather:box",
  "Personne": "Ionicons:person",
  "Lieu": "Ionicons:location",
  "Action": "MaterialCommunityIcons:run",
  "Default": "Ionicons:help-circle-outline"
};

const VALID_CATEGORIES = Object.keys(CATEGORY_ICON_MAP).filter(k => k !== "Default").join(', ');

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] API Key Gemini absente. Generation annulee.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    try {
        console.log('[WORKER] Demarrage de la generation de nouveaux mots...');

        // Le Prompt est maintenant strict sur les catégories
        const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
        L'utilisateur doit deviner le lien logique entre "word1" et "word2".
        Tu dois fournir la nature grammaticale dans "expectedType" (ex: "Nom commun", "Verbe", "Adjectif").
        Tu dois classer chaque mot dans la catégorie la plus pertinente parmi cette liste EXACTE : [${VALID_CATEGORIES}]. Mets la catégorie dans "category1" et "category2".
        Tu dois fournir les réponses acceptées dans 3 catégories :
        - exactMatch : La réponse parfaite.
        - closeMatch : Synonymes très proches (80% de précision).
        - partialMatch : Concept lié (50% de précision).
        
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
            // INTELLIGENCE : On remplace les catégories par les codes icônes exacts
            const finalData = parsedData.map(item => {
                const icon1 = CATEGORY_ICON_MAP[item.category1] || CATEGORY_ICON_MAP["Default"];
                const icon2 = CATEGORY_ICON_MAP[item.category2] || CATEGORY_ICON_MAP["Default"];
                
                // On retire les catégories et on insère les icônes
                const { category1, category2, ...rest } = item;
                return { ...rest, icon1, icon2 };
            });

            await WordPair.insertMany(finalData, { ordered: false });
            console.log(`[WORKER] Succes : ${finalData.length} nouveaux mots injectes dans MongoDB.`);
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la generation IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < DB_WORD_LIMIT) {
            console.log(`[WORKER] Base de donnees en croissance (${count}/${DB_WORD_LIMIT}). Lancement de l'amorce...`);
            await generateAndSaveWords();
        } else {
            console.log(`[WORKER] Base de donnees suffisante (${count}/${DB_WORD_LIMIT}). Generation annulee.`);
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

    initializeWordDatabase();

    cron.schedule('0 * * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Generateur IA arme et securise.');
};

module.exports = initAiWorker; 