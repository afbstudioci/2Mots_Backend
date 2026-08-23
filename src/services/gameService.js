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

const { FALLBACK_VERBS, FALLBACK_NOUNS, FALLBACK_ADJ } = require('../utils/gameFallbacks');

const detectGrammaticalType = (word, declaredType) => {
    if (declaredType && ['verbe', 'nom', 'adjectif'].includes(declaredType.toLowerCase())) {
        return declaredType.toLowerCase();
    }
    const clean = normalizeText(word);
    if (clean.endsWith('er') || clean.endsWith('ir') || clean.endsWith('re') || clean.endsWith('oir')) {
        return 'verbe';
    }
    return 'nom';
};

const enrichPairsWithOptions = async (wordPairs) => {
    const enrichedList = [];

    for (const rawPair of wordPairs) {
        const correctAnswer = (rawPair.exactMatch && rawPair.exactMatch[0]) || rawPair.word1;
        const gramType = detectGrammaticalType(correctAnswer, rawPair.expectedType);

        let distractors = [];
        if (rawPair.distractors && Array.isArray(rawPair.distractors) && rawPair.distractors.length >= 2) {
            distractors = [rawPair.distractors[0], rawPair.distractors[1]];
        } else {
            const poolChoice = gramType === 'verbe' ? FALLBACK_VERBS : (gramType === 'adjectif' ? FALLBACK_ADJ : FALLBACK_NOUNS);
            const filtered = poolChoice.filter(w => normalizeText(w) !== normalizeText(correctAnswer));
            const shuffledFallbacks = shuffleArray(filtered);
            distractors = [shuffledFallbacks[0] || 'Choix A', shuffledFallbacks[1] || 'Choix B'];
        }

        const formattedOptions = shuffleArray([
            correctAnswer,
            distractors[0],
            distractors[1]
        ]);

        // Rareté prestigieuse : 1 seule clé mystère maximum par lot de 30 mots (à l'énigme 18)
        const hasKey = i === 17;

        enrichedList.push({
            _id: rawPair._id,
            word1: rawPair.word1,
            word2: rawPair.word2,
            clue: rawPair.clue,
            expectedType: gramType,
            difficulty: rawPair.difficulty,
            exactMatch: rawPair.exactMatch || [correctAnswer],
            options: formattedOptions,
            hasKey
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
    let isFastCombo = false;

    if (isCorrect) {
        await missionService.updateMissionProgress(userId, 'words_solved');
        earnedKevs = timeSpent <= 3 ? 3 : 1; // +1 de base + 2 bonus si < 3s
        if (timeSpent <= 3) isFastCombo = true;

        user.kevs = (user.kevs || 0) + earnedKevs;
        user.xp += isFastCombo ? 2 : 1;
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

    if (!user.playedWords) user.playedWords = [];
    user.playedWords.push({
        word: pair._id,
        cooldownUntil: calculateCooldown()
    });
    const now = new Date();
    user.playedWords = user.playedWords
        .filter(pw => pw.cooldownUntil && now < new Date(pw.cooldownUntil))
        .slice(-200);

    await user.save();
    const officialAnswer = (pair.exactMatch && pair.exactMatch[0]) ? pair.exactMatch[0] : pair.word1;

    return {
        isCorrect,
        correctAnswer: officialAnswer,
        points,
        accuracy,
        timeWon,
        earnedKevs,
        isFastCombo,
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

const validateFinalSession = async (userId, answers, directScore, kevyKeys, bonusKevs) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    let calculatedScore = 0;
    const corrections = [];

    if (Array.isArray(answers)) {
        for (const item of answers) {
            if (item.isCorrect) {
                calculatedScore += 1;
            } else if (item.wordPairId) {
                const pair = await WordPair.findById(item.wordPairId);
                if (pair) {
                    corrections.push({
                        word1: pair.word1,
                        word2: pair.word2,
                        expectedAnswer: (pair.exactMatch && pair.exactMatch[0]) || 'Inconnu',
                        userAnswer: item.answer || 'Temps écoulé'
                    });
                }
            }
        }
    }

    const sessionScore = typeof directScore === 'number' && directScore >= 0 
        ? directScore 
        : calculatedScore;

    if (sessionScore > (user.bestScore || 0)) {
        user.bestScore = sessionScore;
    }

    if (typeof kevyKeys === 'number' && kevyKeys >= 0 && kevyKeys <= 3) {
        user.kevyKeys = kevyKeys;
    }

    if (typeof bonusKevs === 'number' && bonusKevs > 0) {
        user.kevs = (user.kevs || 0) + bonusKevs;
    }

    if (typeof clientLevel === 'number' && clientLevel > (user.level || 1)) {
        user.level = clientLevel;
        if (typeof clientXp === 'number') user.xp = clientXp;
    } else if (typeof clientLevel === 'number' && clientLevel === (user.level || 1)) {
        if (typeof clientXp === 'number' && clientXp > (user.xp || 0)) {
            user.xp = clientXp;
        }
    }

    await user.save();
    return {
        totalScore: sessionScore,
        bestScore: user.bestScore,
        corrections,
        kevs: user.kevs,
        kevyKeys: user.kevyKeys,
        level: user.level,
        xp: user.xp
    };
};

const syncLevel = async (userId, level, xp, kevs) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    if (typeof level === 'number' && level >= (user.level || 1)) {
        user.level = level;
        if (typeof xp === 'number') user.xp = xp;
        if (typeof kevs === 'number' && kevs > (user.kevs || 0)) user.kevs = kevs;
        await user.save();
    }
    return { level: user.level, xp: user.xp, kevs: user.kevs };
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

const claimChestReward = async (userId, gains) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    user.kevyKeys = 0;
    if (gains && typeof gains.kevs === 'number' && gains.kevs > 0) {
        user.kevs = (user.kevs || 0) + gains.kevs;
    }
    await user.save();
    return { kevyKeys: 0, kevs: user.kevs };
};

const syncUserKeys = async (userId, kevyKeys) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    if (typeof kevyKeys === 'number' && kevyKeys >= 0 && kevyKeys <= 3) {
        user.kevyKeys = kevyKeys;
        await user.save();
    }
    return { kevyKeys: user.kevyKeys };
};

module.exports = {
    enrichPairsWithOptions,
    checkAnswerRealtime,
    useHint,
    validateFinalSession,
    syncLevel,
    syncOfflineSession,
    claimChestReward,
    syncUserKeys
};