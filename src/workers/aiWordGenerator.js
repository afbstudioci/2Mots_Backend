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

    // On divise la génération en 3 paliers pour garantir la qualité
    const tiers = [
        { 
            difficulty: "FACILE (1-3)", 
            count: 20, 
            examples: "Abeille + Fleur = Miel, Couteau + Pain = Couper, Savon + Eau = Mousse",
            logic: "Relations directes, évidentes et ultra-concrètes."
        },
        { 
            difficulty: "MOYEN (4-6)", 
            count: 20, 
            examples: "Pluie + Froid = Verglas, Sel + Plaie = Brûler, Encre + Papier = Écrire",
            logic: "Relations causales nécessitant un raisonnement simple en deux étapes."
        },
        { 
            difficulty: "DIFFICILE (7-10)", 
            count: 20, 
            examples: "Horloge + Sable = Éphémère, Miroir + Fumée = Illusion, Ancre + Vent = Résister",
            logic: "Relations logiques rigoureuses mais non évidentes, nécessitant une réflexion profonde."
        }
    ];

    try {
        console.log(`[WORKER] Lancement de la génération IA par paliers (Modèle : ${geminiModel})...`);

        for (const tier of tiers) {
            const prompt = `Génère ${tier.count} paires de mots en français pour un jeu de réflexion. 
            L'utilisateur doit deviner le lien logique entre "word1" et "word2".
            
            PALIER DE DIFFICULTÉ : ${tier.difficulty}
            LOGIQUE À APPLIQUER : ${tier.logic}
            EXEMPLES À SUIVRE : ${tier.examples}

            RÈGLES STRICTES DE QUALITÉ :
            1. PAS de synonymes, PAS de catégories (ex: ne pas mettre "Fruit" si les mots sont "Pomme" et "Poire").
            2. La solution ("exactMatch") doit être une CAUSALITÉ, un RÉSULTAT ou une ACTION DIRECTE.
            3. INTERDICTION : La solution ne doit JAMAIS être l'un des mots d'origine ou une variation (ex: verbe conjugué du nom).
            4. L'indice ("clue") doit décrire le PROCESSUS logique, pas la réponse elle-même.
            5. TYPOGRAPHIE : Utilise parfaitement les accents français.

            Format JSON attendu (UNIQUEMENT le tableau) :
            [
              {
                "word1": "Mot1",
                "word2": "Mot2",
                "clue": "Description du lien",
                "expectedType": "Verbe/Nom/Adjectif",
                "difficulty": ${tier.difficulty.includes('FACILE') ? 2 : tier.difficulty.includes('MOYEN') ? 5 : 8},
                "exactMatch": ["solution"],
                "closeMatch": ["proche1"],
                "partialMatch": ["lointain1"]
              }
            ]`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();

            responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            const parsedData = JSON.parse(responseText);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                // Validation supplémentaire avant insertion
                const validatedData = parsedData.filter(item => {
                    const sol = item.exactMatch[0].toLowerCase();
                    return sol !== item.word1.toLowerCase() && sol !== item.word2.toLowerCase();
                });

                if (validatedData.length > 0) {
                    await WordPair.insertMany(validatedData, { ordered: false });
                    console.log(`[WORKER] ${validatedData.length} mots ajoutés pour le palier ${tier.difficulty}.`);
                }
            }
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