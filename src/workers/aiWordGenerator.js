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
    return "Tu es un createur expert d'enigmes pour le jeu de reflexion '2 MOTS'.\n" +
        "La mecanique du jeu repose EXCLUSIVEMENT sur la decouverte du POINT COMMUN logique ou de la PROPRIETE PARTAGEE entre deux mots d'entree (word1, word2).\n\n" +
        "REGLES DE CONCEPTION DES ENIGMES :\n\n" +
        "1. LOGIQUE DU POINT COMMUN (exactMatch) :\n" +
        "   - Le mot solution DOIT etre une caracteristique, une propriete, une fonction, une matiere ou un attribut partage sans ambiguite par word1 et word2.\n\n" +
        "2. REGLE POUR LE CHAMP 'clue' (QUESTION SUBTILE) :\n" +
        "   - Formule 'clue' sous forme de courte question ouverte et intrigante qui guide la reflexion SANS vendre la meche.\n" +
        "   - INTERDICTION STRICTE d'utiliser des mots indicateurs directs comme 'couleur', 'matiere', 'forme', 'animal', 'fruit', 'metier', 'verbe', 'nom'.\n" +
        "   - La question doit rester assez ouverte pour que les 3 propositions restent toutes grammaticalement et semantiquement plausibles a la lecture de la question.\n" +
        "   - Exemples de questions subtiles :\n" +
        "     * CITRON + SOLEIL -> exactMatch: 'JAUNE' -> clue: 'Quel eclat partagent-ils ?' (NON : 'Quelle couleur...')\n" +
        "     * OISEAU + AVION -> exactMatch: 'AILES' -> clue: 'Qu\\'exploitent-ils pour dominer les airs ?' (NON : 'Quel membre ont-ils...')\n" +
        "     * TABLE + ARBRE -> exactMatch: 'BOIS' -> clue: 'Quelle essence les relie ?' (NON : 'En quelle matiere sont-ils...')\n" +
        "     * CHRONOMETRE + REGLE -> exactMatch: 'MESURE' -> clue: 'Quelle est leur mission partagee ?' (NON : 'Que mesurent-ils...')\n\n" +
        "3. REGLE D'OR GRAMMATICALE ABSOLUE :\n" +
        "   - exactMatch et les 2 distractors DOIVENT imperativement partager la MEME nature grammaticale (3 adjectifs, 3 noms au singulier, ou 3 verbes a l'infinitif).\n" +
        "   - INTERDICTION STRICTE de melanger les natures de mots dans une meme enigme.\n\n" +
        "4. REGLE DE QUALITE DES DISTRACTEURS (distractors) :\n" +
        "   - Chaque distracteur doit avoir un lien logique fort avec word1 OU word2 individuellement, mais JAMAIS avec les deux en meme temps.\n" +
        "   - Les distracteurs doivent etre des pieges credibles par rapport a la question posee dans 'clue'.\n\n" +
        "5. PROGRESSION PAR DIFFICULTE ('" + difficulty + "') :\n" +
        "   - FACILE : Proprietes physiques observables (ex: 'NEIGE' + 'DENT' -> 'BLANC').\n" +
        "   - MOYEN : Usages, fonctions, matieres, environnements partages (ex: 'LUNETTES' + 'TELESCOPE' -> 'VISION').\n" +
        "   - DIFFICILE : Concepts abstraits, polysemie, caracteristiques invisibles ou metaphoriques (ex: 'BANQUE' + 'FLEUVE' -> 'LIT').\n\n" +
        "Genere exactement 15 enigmes en francais pour la difficulte '" + difficulty + "'.\n\n" +
        "Reponds STRICTEMENT par un tableau JSON valide au format suivant (sans markdown, sans backticks ```json) :\n" +
        "[{\"word1\":\"MOT_1\",\"word2\":\"MOT_2\",\"clue\":\"Courte question subtile ?\",\"expectedType\":\"adjectif\"|\"nom\"|\"verbe\",\"exactMatch\":[\"SOLUTION_COMMUNE\"],\"distractors\":[\"PIEGE_LIE_A_MOT1\",\"PIEGE_LIE_A_MOT2\"]}]";
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