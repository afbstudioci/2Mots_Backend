//src/services/gameService.js
const WordPair = require('../models/WordPair');
const User = require('../models/User');
const missionService = require('./missionService');

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const calculateCooldown = () => {
    return new Date(Date.now() + 2 * 60 * 60 * 1000);
};

const normalizeText = (text) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const enrichPairsWithOptions = async (wordPairs) => {
    const enrichedList = [];

    for (const rawPair of wordPairs) {
        const correctAnswer = (rawPair.exactMatch && rawPair.exactMatch[0]) || rawPair.word1;
        let distractors = [];

        if (rawPair.distractors && Array.isArray(rawPair.distractors) && rawPair.distractors.length >= 2) {
            distractors = [rawPair.distractors[0], rawPair.distractors[1]];
        } else {
            const fallbackVerbs = ['trancher', 'ajuster', 'assembler', 'dessiner', 'sculpter', 'peser', 'mesurer', 'lier', 'fixer', 'guider'];
            const fallbackNouns = ['matiere', 'energie', 'surface', 'volume', 'contour', 'element', 'origine', 'alliage', 'reflet', 'signal'];
            const fallbackAdj = ['robuste', 'precis', 'lumineux', 'profond', 'naturel', 'compact', 'dense', 'fluide', 'stable', 'vif'];
            const poolChoice = rawPair.expectedType === 'verbe' ? fallbackVerbs : (rawPair.expectedType === 'adjectif' ? fallbackAdj : fallbackNouns);
            const filtered = poolChoice.filter(w => normalizeText(w) !== normalizeText(correctAnswer));
            const shuffledFallbacks = shuffleArray(filtered);
            distractors = [shuffledFallbacks[0] || 'Option A', shuffledFallbacks[1] || 'Option B'];
        }

        // GARANTIR UN MÉLANGE ALÉATOIRE ABSOLU DES 3 OPTIONS
        const formattedOptions = shuffleArray([
            correctAnswer,
            distractors[0],
            distractors[1]
        ]);

        enrichedList.push({
            _id: rawPair._id,
            word1: rawPair.word1,
            word2: rawPair.word2,
            clue: rawPair.clue,
            expectedType: rawPair.expectedType,
            difficulty: rawPair.difficulty,
            exactMatch: rawPair.exactMatch || [correctAnswer],
            options: formattedOptions
        });
    }

    return enrichedList;
};

const checkAnswerRealtime = async (userId, wordPairId, userAnswer, timeSpent) => {
    const pair = await WordPair.findById(wordPairId);
    if (!pair) throw createError('Enigme introuvable', 404);

    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    const normalizedAnswer = normalizeText(userAnswer);
    let isCorrect = false;
    let points = 0;
    let accuracy = 0;

    const checkArray = (arr) =>
        arr && Array.isArray(arr) ? arr.map(normalizeText).includes(normalizedAnswer) : false;

    if (checkArray(pair.exactMatch)) {
        isCorrect = true;
        points = 10;
        accuracy = 100;
    } else if (checkArray(pair.closeMatch)) {
        isCorrect = true;
        points = 8;
        accuracy = 80;
    } else if (checkArray(pair.partialMatch)) {
        isCorrect = true;
        points = 5;
        accuracy = 50;
    }

    let timeWon = 0;
    let earnedKevs = 0;
    let leveledUp = false;
    let currentXp = user.xp;
    let newLevel = user.level;

    if (isCorrect) {
        await missionService.updateMissionProgress(userId, 'words_solved');
        earnedKevs = 1;
        user.kevs = (user.kevs || 0) + earnedKevs;
        user.xp += 1;
        currentXp = user.xp;

        const enigmasNeeded = 3 + user.level * 2;
        if (user.xp >= enigmasNeeded) {
            user.level += 1;
            user.xp -= enigmasNeeded;
            currentXp = user.xp;
            newLevel = user.level;
            leveledUp = true;
            earnedKevs += 5;
            user.kevs += 5;

            await missionService.updateMissionProgress(userId, 'levels_reached');
        }

        timeWon = timeSpent <= 5 ? 8 : (timeSpent <= 15 ? 5 : 3);
    }

    await user.save();
    const officialAnswer = (pair.exactMatch && pair.exactMatch[0]) ? pair.exactMatch[0] : pair.word1;

    return {
        isCorrect,
        correctAnswer: officialAnswer,
        points,
        accuracy,
        timeWon,
        earnedKevs,
        totalKevs: user.kevs,
        leveledUp,
        newLevel,
        currentXp,
        xpNeeded: 3 + newLevel * 2,
        logicalHint: pair.clue
    };
};

const useHint = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);
    if (user.kevs < 5) {
        throw createError('Kevs insuffisants. 5 Kevs requis pour le 50/50.', 400);
    }
    user.kevs -= 5;
    await user.save();
    return { kevs: user.kevs };
};

const validateFinalSession = async (userId, answers) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);
    if (!answers || !Array.isArray(answers)) throw createError('Format invalide', 400);

    let totalScore = 0;
    const corrections = [];

    for (const item of answers) {
        if (!item.wordPairId) continue;
        const pair = await WordPair.findById(item.wordPairId);
        if (!pair) continue;

        const userAnswer = normalizeText(item.answer);
        const checkArray = (arr) => arr && Array.isArray(arr) ? arr.map(normalizeText).includes(userAnswer) : false;

        const isCorrect = checkArray(pair.exactMatch);
        if (isCorrect) totalScore += 10;
        else {
            corrections.push({
                word1: pair.word1,
                word2: pair.word2,
                expectedAnswer: (pair.exactMatch && pair.exactMatch[0]) || 'Inconnu',
                userAnswer: item.answer || 'Non repondu'
            });
        }
    }

    if (totalScore > (user.bestScore || 0)) {
        user.bestScore = totalScore;
    }

    await user.save();
    return { totalScore, corrections, kevs: user.kevs };
};

const syncOfflineSession = async (userId, sessionData) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    const { rounds } = sessionData;
    if (!rounds || !Array.isArray(rounds)) throw createError('Session invalide', 400);

    let calculatedScore = 0;
    let earnedKevs = 0;

    for (const r of rounds) {
        if (r.isCorrect) {
            calculatedScore += 10;
            earnedKevs += 1;
        }
    }

    user.kevs = (user.kevs || 0) + earnedKevs;
    if (calculatedScore > (user.bestScore || 0)) {
        user.bestScore = calculatedScore;
    }

    await user.save();
    return { synced: true, earnedKevs, totalKevs: user.kevs };
};

module.exports = {
    enrichPairsWithOptions,
    checkAnswerRealtime,
    useHint,
    validateFinalSession,
    syncOfflineSession
};