//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 50000;

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente. Generation annulee.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const tiers = [
        { 
            difficulty: "FACILE (1-3)", 
            count: 20,
            targetDiff: 2,
            guidelines: "Associations universelles du quotidien, objets, nature, actions simples et concrètes. Zéro abstraction philosophique.",
            examples: `
            [
              {"word1": "Abeille", "word2": "Fleur", "clue": "Action de récolter le nectar", "expectedType": "verbe", "exactMatch": ["butiner"], "distractors": ["piquer", "voler"]},
              {"word1": "Soleil", "word2": "Mer", "clue": "Étendue de sable au bord de l'eau", "expectedType": "nom", "exactMatch": ["plage"], "distractors": ["piscine", "dune"]},
              {"word1": "Couteau", "word2": "Pain", "clue": "Action de séparer avec une lame", "expectedType": "verbe", "exactMatch": ["couper"], distractors: ["trancher", "tartiner"]}
            ]`
        },
        { 
            difficulty: "MOYEN (4-6)", 
            count: 20,
            targetDiff: 5,
            guidelines: "Relations de cause à effet, culture générale, mécanismes physiques et expressions populaires vivantes.",
            examples: `
            [
              {"word1": "Champagne", "word2": "Coupe", "clue": "Formation continue de fines bulles", "expectedType": "verbe", "exactMatch": ["pétiller"], "distractors": ["trinquer", "mousser"]},
              {"word1": "Fer", "word2": "Humidité", "clue": "Couche rougeâtre due à l'oxydation", "expectedType": "nom", "exactMatch": ["rouille"], "distractors": ["peinture", "mousse"]},
              {"word1": "Glaçon", "word2": "Soleil", "clue": "Passage de l'état solide à liquide", "expectedType": "verbe", "exactMatch": ["fondre"], "distractors": ["évaporer", "chauffer"]}
            ]`
        },
        { 
            difficulty: "DIFFICILE (7-10)", 
            count: 20,
            targetDiff: 8,
            guidelines: "Défis d'esprit stimulants, jeux de mots fins, sciences accessibles et subtilités du vocabulaire français.",
            examples: `
            [
              {"word1": "Écho", "word2": "Silence", "clue": "Action de faire cesser brusquement le calme", "expectedType": "verbe", "exactMatch": ["rompre"], "distractors": ["résonner", "troubler"]},
              {"word1": "Éclat", "word2": "Diamant", "clue": "Action de briller intensément par reflets", "expectedType": "verbe", "exactMatch": ["scintiller"], "distractors": ["éblouir", "rayonner"]},
              {"word1": "Boussole", "word2": "Nord", "clue": "Action d'indiquer la bonne direction", "expectedType": "verbe", "exactMatch": ["orienter"], "distractors": ["guider", "pointer"]}
            ]`
        }
    ];

    try {
        console.log(`[WORKER] Lancement de la generation IA par paliers (Modele : ${geminiModel})...`);

        for (const tier of tiers) {
            const prompt = `Tu es le concepteur en chef d'un jeu mobile de réflexion en français appelé "2Mots".
Dans ce jeu, le joueur voit 2 mots et doit déduire la solution qui les unit logiquement.

MISSION : Génère ${tier.count} énigmes de difficulté ${tier.difficulty}.
GUIDE : ${tier.guidelines}

EXEMPLES DE QUALITÉ ATTENDUE :
${tier.examples}

RÈGLES CAPITALES :
1. LOGIQUE PARFAITE : L'énigme doit être concrète, évidente dès qu'on y pense, jamais abstraite ou tirée par les cheveux.
2. DISTRACTEURS PERTINENTS (TRÈS IMPORTANT) :
   - "distractors" DOIT contenir exactement 2 FAUSSES PROPOSITIONS.
   - Ces 2 pièges DOIVENT être dans LE MÊME THÈME que les 2 mots (ex: si le thème est le diamant, les pièges parlent de lumière/taille/bijou).
   - Ces 2 pièges DOIVENT être de la MÊME NATURE GRAMMATICALE que la solution (ex: si la solution est un verbe à l'infinitif, les 2 pièges sont aussi des verbes à l'infinitif).
   - INTERDICTION d'utiliser des mots génériques passe-partout comme "nettoyer", "laver", "courir", "brûler" sauf si c'est directement le sujet de l'énigme.
3. NATURE GRAMMATICALE ("expectedType") : Choisis uniquement parmi "nom", "verbe" (à l'infinitif), ou "adjectif".
4. INTERDICTION : La solution ne doit pas être une répétition d'un des 2 mots.
5. FORMAT : Renvoie UNIQUEMENT un tableau JSON valide.

Format JSON attendu :
[
  {
    "word1": "PremierMot",
    "word2": "DeuxiemeMot",
    "clue": "Indice logique concis et élégant",
    "expectedType": "nom|verbe|adjectif",
    "difficulty": ${tier.targetDiff},
    "exactMatch": ["solution"],
    "distractors": ["fauxChoix1", "fauxChoix2"]
  }
]`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();

            responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            const parsedData = JSON.parse(responseText);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                const validatedData = parsedData.filter(item => {
                    const sol = (item.exactMatch && item.exactMatch[0] || '').toLowerCase();
                    const w1 = (item.word1 || '').toLowerCase();
                    const w2 = (item.word2 || '').toLowerCase();
                    const hasDistractors = Array.isArray(item.distractors) && item.distractors.length >= 2;
                    return sol && sol !== w1 && sol !== w2 && hasDistractors;
                });

                if (validatedData.length > 0) {
                    await WordPair.insertMany(validatedData, { ordered: false });
                    console.log(`[WORKER] ${validatedData.length} énigmes de haute qualité ajoutées pour ${tier.difficulty}.`);
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
            console.log(`[WORKER] Base de données (${count}/${DB_WORD_LIMIT})...`);
            await generateAndSaveWords();
        }
    } catch (error) {
        console.error('[WORKER] Erreur de verification :', error.message);
    }
};

const initAiWorker = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente.");
        return;
    }

    initializeWordDatabase();

    cron.schedule('0 */2 * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Generateur IA Logique Contextuelle & Distracteurs actifs.');
};

module.exports = initAiWorker;