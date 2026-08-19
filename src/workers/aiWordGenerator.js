//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 1500; // Plafond maximal strict (500 Faciles, 500 Moyens, 500 Difficiles = ~0.5 Mo)
const DAILY_GEN_LIMIT = 300; // Maximum d'enigmes generees par 24H

let dailyGeneratedCount = 0;
let lastResetDate = new Date().getUTCDate();

const resetDailyQuotaIfNeeded = () => {
    const today = new Date().getUTCDate();
    if (today !== lastResetDate) {
        dailyGeneratedCount = 0;
        lastResetDate = today;
        console.log('[WORKER] Quota journalier d''enigmes reinitialise pour les prochaines 24H.');
    }
};

const generateAndSaveWords = async () => {
    resetDailyQuotaIfNeeded();

    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente. Generation annulee.");
        return;
    }

    if (dailyGeneratedCount >= DAILY_GEN_LIMIT) {
        console.log(`[WORKER] Quota journalier atteint (${dailyGeneratedCount}/${DAILY_GEN_LIMIT} sur 24H). Pause jusqu'a demain.`);
        return;
    }

    const totalCount = await WordPair.countDocuments();
    if (totalCount >= DB_WORD_LIMIT) {
        console.log(`[WORKER] Plafond global atteint (${totalCount}/${DB_WORD_LIMIT}). Stock optimal de 0.5 Mo respecte.`);
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const tiers = [
        { difficulty: "FACILE (niveaux 1 a 3)", targetDiff: 2 },
        { difficulty: "MOYEN (niveaux 4 a 6)", targetDiff: 5 },
        { difficulty: "DIFFICILE (niveaux 7 a 10)", targetDiff: 8 }
    ];

    try {
        console.log(`[WORKER] Generation IA en cours (${dailyGeneratedCount}/${DAILY_GEN_LIMIT} aujourd'hui, Total BDD: ${totalCount}/${DB_WORD_LIMIT})...`);

        for (const tier of tiers) {
            if (dailyGeneratedCount >= DAILY_GEN_LIMIT) break;

            const prompt = `Tu es le Lead Game Designer du jeu mobile de reflexion en francais "2Mots".
Dans ce jeu, le joueur voit deux mots (\`word1\`, \`word2\`) et un indice (\`clue\`), puis doit identifier le mot unique (\`exactMatch\`) qui les relie logiquement parmi un choix multiple compose de la solution et de 2 distracteurs (\`distractors\`).

MISSION :
Genere un tableau JSON valide de 15 enigmes equilibrees et inedites.
Niveau de difficulte cible : ${tier.difficulty}.

REGLES STRICTES :
1. LOGIQUE & CONCRET : Associations directes, concepts du quotidien, objets, metiers, nature ou actions claires.
2. SOLUTION (\`exactMatch\`) : tableau avec une seule chaine en minuscules, sans article, distincte de word1 et word2.
3. DISTRACTEURS (\`distractors\`) : exactement 2 chaines distinctes de MEME nature grammaticale que la solution, thematiquement proches mais fausses, sans aucun synonyme de la reponse.
4. NATURE (\`expectedType\`) : "nom", "verbe" (a l'infinitif) ou "adjectif".
5. INDICE (\`clue\`) : definition ou indice concis (max 10 mots).

Reponds UNIQUEMENT avec le tableau JSON brut (sans balises markdown).`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();

            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(responseText);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                const validatedData = parsedData.filter(item => {
                    const sol = (item.exactMatch && item.exactMatch[0] || '').toLowerCase();
                    const w1 = (item.word1 || '').toLowerCase();
                    const w2 = (item.word2 || '').toLowerCase();
                    const hasDistractors = Array.isArray(item.distractors) && item.distractors.length >= 2;
                    return sol && sol !== w1 && sol !== w2 && hasDistractors;
                }).map(item => ({
                    ...item,
                    difficulty: item.difficulty || tier.targetDiff,
                    isActive: true,
                }));

                if (validatedData.length > 0) {
                    await WordPair.insertMany(validatedData, { ordered: false });
                    dailyGeneratedCount += validatedData.length;
                    console.log(`[WORKER] +${validatedData.length} enigmes inserees pour ${tier.difficulty}. (Cumul 24H: ${dailyGeneratedCount}/${DAILY_GEN_LIMIT})`);
                }
            }
        }
    } catch (error) {
        console.error('[WORKER] Erreur generation IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < DB_WORD_LIMIT) {
            console.log(`[WORKER] Verification stock (${count}/${DB_WORD_LIMIT})...`);
            await generateAndSaveWords();
        }
    } catch (error) {
        console.error('[WORKER] Erreur verification :', error.message);
    }
};

const initAiWorker = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente.");
        return;
    }

    initializeWordDatabase();

    // Verification planifiee toutes les 4 heures
    cron.schedule('0 */4 * * *', async () => {
        await initializeWordDatabase();
    });

    // Reset strict du compteur a minuit UTC
    cron.schedule('0 0 * * *', () => {
        dailyGeneratedCount = 0;
        lastResetDate = new Date().getUTCDate();
        console.log('[WORKER] Minuit UTC : Quota journalier 24H reinitialise a 0.');
    });

    console.log('[WORKER] Generateur IA active (Plafond: 1500 enigmes, Quota max: 300/24H).');
};

module.exports = initAiWorker;