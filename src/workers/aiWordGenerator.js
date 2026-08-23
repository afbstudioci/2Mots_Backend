//src/workers/aiWordGenerator.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey } = require('../config/env');

const DB_WORD_LIMIT = 2000;
const DAILY_GEN_LIMIT = 300;
let dailyGeneratedCount = 0;
let lastResetDate = new Date().getUTCDate();

const checkAndResetDailyQuota = () => {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== lastResetDate) {
        dailyGeneratedCount = 0;
        lastResetDate = currentDay;
        console.log("[WORKER] Quota journalier d'enigmes reinitialise.");
    }
};

const difficulties = ['FACILE', 'MOYEN', 'DIFFICILE'];

const buildGenerationPrompt = (difficulty) => {
    return "Tu es un createur expert d'enigmes pour le jeu '2 MOTS'.\n" +
        "La mecanique repose sur la decouverte du POINT COMMUN logique partage par deux mots (word1, word2).\n\n" +
        "REGLES STRICTES :\n" +
        "1. exactMatch : Le mot solution partage sans ambiguite par word1 et word2.\n" +
        "2. clue : Courte question subtile et ouverte guidant la reflexion sans donner la categorie.\n" +
        "3. GRAMMAIRE : exactMatch et les 2 distractors partagent STRICTEMENT la meme nature (3 noms, 3 verbes ou 3 adjectifs).\n" +
        "4. distractors : 2 pieges plausibles lies a word1 OU word2 individuellement.\n" +
        "5. difficulte : '" + difficulty + "'.\n\n" +
        "Genere exactement 15 enigmes en francais.\n" +
        "Reponds STRICTEMENT par un tableau JSON valide (sans markdown) :\n" +
        "[{\"word1\":\"MOT1\",\"word2\":\"MOT2\",\"clue\":\"Question ?\",\"expectedType\":\"adjectif\"|\"nom\"|\"verbe\",\"exactMatch\":[\"SOLUTION\"],\"distractors\":[\"PIEGE1\",\"PIEGE2\"]}]";
};

const seedCuratedDatasetIfNeeded = async () => {
    try {
        const totalWords = await WordPair.countDocuments();
        if (totalWords < 120) {
            const part1 = require('../scripts/dataset/wordPairsPart1');
            const part2 = require('../scripts/dataset/wordPairsPart2');
            const part3 = require('../scripts/dataset/wordPairsPart3');
            const part4 = require('../scripts/dataset/wordPairsPart4');
            const dataset = [...part1, ...part2, ...part3, ...part4];

            const ops = dataset.map(item => ({
                updateOne: {
                    filter: { word1: item.word1.toLowerCase().trim(), word2: item.word2.toLowerCase().trim() },
                    update: { $set: { ...item, isActive: true } },
                    upsert: true
                }
            }));
            await WordPair.bulkWrite(ops);
            console.log(`[WORKER] Catalogue de base enrichi avec succès (${dataset.length} énigmes).`);
        }
    } catch (e) {
        console.warn('[WORKER] Initialisation catalogue ignoree:', e.message);
    }
};

const generateAndStoreWords = async () => {
    await seedCuratedDatasetIfNeeded();

    if (!geminiApiKey) return;

    try {
        checkAndResetDailyQuota();
        if (dailyGeneratedCount >= DAILY_GEN_LIMIT) return;

        const totalWords = await WordPair.countDocuments();
        if (totalWords >= DB_WORD_LIMIT) return;

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const candidateModels = ['gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];

        for (const diff of difficulties) {
            if (dailyGeneratedCount >= DAILY_GEN_LIMIT) break;

            const prompt = buildGenerationPrompt(diff);
            let rawText = null;

            for (const mName of candidateModels) {
                try {
                    const modelInstance = genAI.getGenerativeModel({ model: mName });
                    const result = await modelInstance.generateContent(prompt);
                    rawText = result.response.text();
                    if (rawText) break;
                } catch (mErr) {
                    // Essai du modèle suivant
                }
            }

            if (!rawText) continue;

            let cleanJson = rawText.trim();
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
                let inserted = 0;
                const difficultyNum = diff === 'FACILE' ? 2 : (diff === 'MOYEN' ? 5 : 8);

                for (const item of parsed) {
                    if (item.word1 && item.word2 && item.exactMatch?.length > 0) {
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
                                difficulty: difficultyNum,
                                expectedType: item.expectedType || 'nom',
                                clue: item.clue || '',
                                isActive: true
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