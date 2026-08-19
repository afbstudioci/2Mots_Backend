//src/workers/aiWordGenerator.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey } = require('../config/env');

const DB_WORD_LIMIT = 1500;
const DAILY_GEN_LIMIT = 300;
let dailyGeneratedCount = 0;
let lastResetDate = new Date().getUTCDate();

const checkAndResetDailyQuota = () => {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== lastResetDate) {
        dailyGeneratedCount = 0;
        lastResetDate = currentDay;
        console.log("[WORKER] Quota journalier d'enigmes reinitialise pour les prochaines 24H.");
    }
};

const difficulties = ['FACILE', 'MOYEN', 'DIFFICILE'];

const buildGenerationPrompt = (difficulty) => {
    return "Tu es un createur expert d'enigmes pour le jeu '2 MOTS'. " +
        "L'objectif est d'associer deux mots francais indices avec un troisieme mot mystere. " +
        "Genere exactement 15 enigmes de haute precision en francais pour la difficulte '" + difficulty + "'. " +
        "Reponds STRICTEMENT avec un tableau JSON valide.";
};

const generateAndStoreWords = async () => {
    if (!geminiApiKey) return;

    try {
        checkAndResetDailyQuota();

        if (dailyGeneratedCount >= DAILY_GEN_LIMIT) {
            return;
        }

        const totalWords = await WordPair.countDocuments();
        if (totalWords >= DB_WORD_LIMIT) {
            return;
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        for (const diff of difficulties) {
            if (dailyGeneratedCount >= DAILY_GEN_LIMIT) break;

            const prompt = buildGenerationPrompt(diff);
            const result = await model.generateContent(prompt);
            const rawText = result.response.text();

            let cleanJson = rawText.trim();
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
                let inserted = 0;
                for (const item of parsed) {
                    if (item.word1 && item.word2 && item.options && item.exactMatch) {
                        const exists = await WordPair.findOne({
                            word1: item.word1.toLowerCase().trim(),
                            word2: item.word2.toLowerCase().trim()
                        });
                        if (!exists) {
                            await WordPair.create({
                                word1: item.word1.toLowerCase().trim(),
                                word2: item.word2.toLowerCase().trim(),
                                options: item.options,
                                exactMatch: item.exactMatch,
                                difficulty: diff,
                                expectedType: item.expectedType || 'nom',
                                clue: item.clue || ''
                            });
                            inserted++;
                            dailyGeneratedCount++;
                        }
                    }
                }
                if (inserted > 0) {
                    console.log(`[WORKER] ${inserted} nouvelles enigmes inserees pour ${diff}.`);
                }
            }
        }
    } catch (err) {
        console.error('[WORKER] Erreur generation IA :', err.message);
    }
};

const initAiWorker = () => {
    generateAndStoreWords();
    setInterval(generateAndStoreWords, 60 * 60 * 1000);
};

module.exports = initAiWorker;