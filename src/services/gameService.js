const WordPair = require('../models/WordPair');
const User = require('../models/User');
const missionService = require('./missionService');
const vaultService = require('./vaultService');
const { FALLBACK_VERBS, FALLBACK_NOUNS, FALLBACK_ADJ } = require('../utils/gameFallbacks');

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const calculateCooldown = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const normalizeText = (text) => (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const detectGrammaticalType = (word, declaredType) => {
    if (declaredType && ['verbe', 'nom', 'adjectif'].includes(declaredType.toLowerCase())) return declaredType.toLowerCase();
    const clean = normalizeText(word);
    return (clean.endsWith('er') || clean.endsWith('ir') || clean.endsWith('re') || clean.endsWith('oir')) ? 'verbe' : 'nom';
};

const recordPlayedWords = (user, items) => {
    if (!user.playedWords) user.playedWords = [];
    const cooldown = calculateCooldown();
    const now = new Date();
    (items || []).filter(Boolean).forEach(item => {
        if (typeof item === 'string') {
            user.playedWords.push({ word: item, cooldownUntil: cooldown, playedAt: now });
        } else if (typeof item === 'object') {
            if (item._id) user.playedWords.push({ word: String(item._id), cooldownUntil: cooldown, playedAt: now });
            if (item.semanticSignature) user.playedWords.push({ word: String(item.semanticSignature), cooldownUntil: cooldown, playedAt: now });
        }
    });
    user.playedWords = user.playedWords.filter(pw => pw.cooldownUntil && now < new Date(pw.cooldownUntil)).slice(-10000);
};

const recordPlayedWordsAtomic = async (userId, items) => {
    if (!userId || !items || items.length === 0) return;
    const cooldown = calculateCooldown();
    const now = new Date();
    const newItems = [];
    for (const item of items) {
        if (!item) continue;
        if (typeof item === 'string') {
            newItems.push({ word: item, cooldownUntil: cooldown, playedAt: now });
        } else if (typeof item === 'object') {
            if (item._id) newItems.push({ word: String(item._id), cooldownUntil: cooldown, playedAt: now });
            if (item.semanticSignature) newItems.push({ word: String(item.semanticSignature), cooldownUntil: cooldown, playedAt: now });
        }
    }
    if (newItems.length === 0) return;
    await User.updateOne(
        { _id: userId },
        {
            $push: {
                playedWords: {
                    $each: newItems,
                    $slice: -10000
                }
            }
        }
    );
};

const enrichPairsWithOptions = async (wordPairs) => {
    return wordPairs.map((rawPair, i) => {
        const correctAnswer = (rawPair.exactMatch && rawPair.exactMatch[0]) || rawPair.word1;
        const gramType = detectGrammaticalType(correctAnswer, rawPair.expectedType);
        let distractors = (rawPair.distractors && rawPair.distractors.length >= 2) ? [rawPair.distractors[0], rawPair.distractors[1]] : null;
        if (!distractors) {
            const poolChoice = gramType === 'verbe' ? FALLBACK_VERBS : (gramType === 'adjectif' ? FALLBACK_ADJ : FALLBACK_NOUNS);
            const filtered = shuffleArray(poolChoice.filter(w => normalizeText(w) !== normalizeText(correctAnswer)));
            distractors = [filtered[0] || 'Choix A', filtered[1] || 'Choix B'];
        }
        return {
            _id: rawPair._id,
            word1: rawPair.word1,
            word2: rawPair.word2,
            clue: rawPair.clue,
            expectedType: gramType,
            difficulty: rawPair.difficulty,
            exactMatch: rawPair.exactMatch || [correctAnswer],
            options: shuffleArray([correctAnswer, distractors[0], distractors[1]]),
            hasKey: i === 17
        };
    });
};

const checkAnswerRealtime = async (userId, wordPairId, userAnswer, timeSpent) => {
    const pair = String(wordPairId).startsWith('vlt_') ? vaultService.findEnigma(wordPairId) : await WordPair.findById(wordPairId);
    const resolvedPair = pair || { _id: wordPairId, exactMatch: [userAnswer], clue: '' };
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    const normalizedAnswer = normalizeText(userAnswer);
    const checkArray = (arr) => arr && Array.isArray(arr) ? arr.map(normalizeText).includes(normalizedAnswer) : false;
    let isCorrect = false, points = 0, accuracy = 0;

    if (checkArray(resolvedPair.exactMatch)) { isCorrect = true; points = 10; accuracy = 100; }
    else if (checkArray(resolvedPair.closeMatch)) { isCorrect = true; points = 8; accuracy = 80; }
    else if (checkArray(resolvedPair.partialMatch)) { isCorrect = true; points = 5; accuracy = 50; }

    let timeWon = 0, earnedKevs = 0, leveledUp = false, currentXp = user.xp, newLevel = user.level, isFastCombo = false;
    if (isCorrect) {
        await missionService.updateMissionProgress(userId, 'words_solved');
        isFastCombo = timeSpent <= 3;
        const totalSolved = (user.playedWords ? user.playedWords.length : 0) + 1;
        earnedKevs = isFastCombo ? 1 : (totalSolved % 2 === 0 ? 1 : 0);
        user.kevs = (user.kevs || 0) + earnedKevs;
        user.xp = (user.xp || 0) + (isFastCombo ? 2 : 1);
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

    recordPlayedWords(user, [resolvedPair._id]);

    // Sécurisation atomique : ne jamais écraser un level supérieur enregistré en parallèle
    const latest = await User.findById(userId).select('level xp kevs');
    if (latest) {
        if (latest.level > user.level) {
            user.level = latest.level;
            user.xp = latest.xp;
        } else if (latest.level === user.level && latest.xp > user.xp) {
            user.xp = latest.xp;
        }
        if (latest.kevs > user.kevs) {
            user.kevs = latest.kevs;
        }
    }

    await user.save();
    const officialAnswer = (resolvedPair.exactMatch && resolvedPair.exactMatch[0]) || resolvedPair.word1;

    return {
        isCorrect, correctAnswer: officialAnswer, points, accuracy, timeWon, earnedKevs,
        isFastCombo, totalKevs: user.kevs, leveledUp, newLevel: user.level, currentXp: user.xp,
        xpNeeded: 3 + user.level * 2, logicalHint: resolvedPair.clue
    };
};

const useHint = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);
    if (user.kevs < 5) throw createError('Kevs insuffisants. 5 Kevs requis.', 400);
    user.kevs -= 5;
    await user.save();
    return { kevs: user.kevs };
};

const validateFinalSession = async (userId, answers, directScore, kevyKeys, bonusKevs, clientLevel, clientXp) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    let calculatedScore = 0;
    const corrections = [];
    if (Array.isArray(answers)) {
        recordPlayedWords(user, answers.map(a => a.wordPairId));
        for (const item of answers) {
            if (item.isCorrect) {
                calculatedScore += 1;
            } else if (item.wordPairId) {
                const pair = String(item.wordPairId).startsWith('vlt_') ? vaultService.findEnigma(item.wordPairId) : await WordPair.findById(item.wordPairId);
                if (pair) {
                    corrections.push({
                        word1: pair.word1, word2: pair.word2,
                        expectedAnswer: (pair.exactMatch && pair.exactMatch[0]) || 'Inconnu',
                        userAnswer: item.answer || 'Temps écoulé'
                    });
                }
            }
        }
    }

    const sessionScore = typeof directScore === 'number' && directScore >= 0 ? directScore : calculatedScore;
    if (sessionScore > (user.bestScore || 0)) user.bestScore = sessionScore;
    if (typeof kevyKeys === 'number' && kevyKeys >= 0 && kevyKeys <= 3) user.kevyKeys = kevyKeys;
    if (typeof bonusKevs === 'number' && bonusKevs > 0) user.kevs = (user.kevs || 0) + bonusKevs;

    if (typeof clientLevel === 'number' && clientLevel > (user.level || 1)) {
        user.level = clientLevel;
        user.xp = typeof clientXp === 'number' ? clientXp : 0;
    } else if (typeof clientLevel === 'number' && clientLevel === (user.level || 1) && typeof clientXp === 'number' && clientXp > (user.xp || 0)) {
        user.xp = clientXp;
    }

    await user.save();
    return {
        totalScore: sessionScore, bestScore: user.bestScore, corrections,
        kevs: user.kevs, kevyKeys: user.kevyKeys, level: user.level, xp: user.xp
    };
};

const syncLevel = async (userId, level, xp, kevs) => {
    if (typeof level !== 'number' || level < 1) return;
    const updated = await User.findOneAndUpdate(
        {
            _id: userId,
            $or: [
                { level: { $lt: level } },
                { level: level, xp: { $lte: xp || 0 } }
            ]
        },
        {
            $set: { level, xp: xp || 0 },
            ...(typeof kevs === 'number' && kevs > 0 ? { $max: { kevs } } : {})
        },
        { new: true }
    );
    const user = updated || await User.findById(userId);
    return { level: user.level, xp: user.xp, kevs: user.kevs };
};

const syncOfflineSession = async (userId, sessionData) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);
    const { rounds } = sessionData;
    if (!rounds || !Array.isArray(rounds)) throw createError('Session invalide', 400);

    let calculatedScore = 0, earnedKevs = 0;
    for (const r of rounds) {
        if (r.isCorrect) { calculatedScore += 10; earnedKevs += 1; }
    }
    user.kevs = (user.kevs || 0) + earnedKevs;
    if (calculatedScore > (user.bestScore || 0)) user.bestScore = calculatedScore;
    await user.save();
    return { synced: true, earnedKevs, totalKevs: user.kevs };
};

const claimChestReward = async (userId, gains) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);
    user.kevyKeys = 0;
    if (gains && typeof gains.kevs === 'number' && gains.kevs > 0) user.kevs = (user.kevs || 0) + gains.kevs;
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
    recordPlayedWords,
    recordPlayedWordsAtomic,
    enrichPairsWithOptions,
    checkAnswerRealtime,
    useHint,
    validateFinalSession,
    syncLevel,
    syncOfflineSession,
    claimChestReward,
    syncUserKeys
};