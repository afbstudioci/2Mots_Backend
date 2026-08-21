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
        "L'objectif est d'associer deux mots francais indices (word1, word2) avec un troisieme mot mystere (exactMatch).\n" +
        "REGLE D'OR GRAMMATICALE ABSOLUE :\n" +
        "- Si exactMatch est un verbe a l'infinitif (ex: 'chanter'), expectedType DOIT valoir 'verbe' ET distractors DOIVENT etre 2 verbes a l'infinitif (ex: ['danser', 'jouer']).\n" +
        "- Si exactMatch est un nom (ex: 'plage'), expectedType DOIT valoir 'nom' ET distractors DOIVENT etre 2 noms (ex: ['piscine', 'desert']).\n" +
        "- Si exactMatch est un adjectif (ex: 'lumineux'), expectedType DOIT valoir 'adjectif' ET distractors DOIVENT etre 2 adjectifs (ex: ['sombre', 'brillant']).\n" +
        "INTERDICTION FORMELLE de melanger les natures grammaticales dans une enigme.\n" +
        "Genere exactement 15 enigmes en francais pour la difficulte '" + difficulty + "'.\n" +
        "Reponds STRICTEMENT par un JSON valide au format: [{\"word1\":\"...\",\"word2\":\"...\",\"clue\":\"...\",\"expectedType\":\"verbe\"|\"nom\"|\"adjectif\",\"exactMatch\":[\"...\"],\"distractors\":[\"...\", \"...\"]}]";
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
                    if (item.word1 && item.word2 && item.exactMatch && item.exactMatch.length > 0) {
                        const exists = await WordPair.findOne({
                            word1: item.word1.toLowerCase().trim(),
                            word2: item.word2.toLowerCase().trim()
                        });
                        if (!exists) {
                            const exact = Array.isArray(item.exactMatch) ? item.exactMatch : [item.exactMatch];
                            const distractors = Array.isArray(item.distractors) && item.distractors.length >= 2
                                ? [item.distractors[0].toLowerCase().trim(), item.distractors[1].toLowerCase().trim()]
                                : [];
                            const options = Array.isArray(item.options) && item.options.length >= 3
                                ? item.options
                                : [exact[0], ...(distractors.length >= 2 ? distractors : [])];

                            await WordPair.create({
                                word1: item.word1.toLowerCase().trim(),
                                word2: item.word2.toLowerCase().trim(),
                                options: options,
                                exactMatch: exact.map(w => w.toLowerCase().trim()),
                                distractors: distractors,
                                difficulty: diff,
                                expectedType: item.expectedType || (exact[0].endsWith('er') || exact[0].endsWith('ir') || exact[0].endsWith('re') ? 'verbe' : 'nom'),
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