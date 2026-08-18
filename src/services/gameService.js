//src/services/gameService.js
const WordPair = require('../models/WordPair');
const User = require('../models/User');
const missionService = require('./missionService');

const normalizeText = (text) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const calculateCooldown = () => {
    const minDays = 7;
    const maxDays = 30;
    const randomDays = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + randomDays);
    return cooldownDate;
};

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const enrichPairsWithOptions = async (wordPairs) => {
    const enrichedList = [];

    const fallbackByType = {
        nom: ['Voyage', 'Soleil', 'Miroir', 'Lumière', 'Secret', 'Écho', 'Flamme', 'Océan', 'Plage', 'Lune', 'Étoile'],
        verbe: ['Courir', 'Partager', 'Briller', 'Écouter', 'Construire', 'Voler', 'Créer', 'Ouvrir', 'Couper'],
        adjectif: ['Rapide', 'Lumineux', 'Solide', 'Silencieux', 'Immense', 'Précieux', 'Inviolable', 'Éphémère'],
    };

    for (const pair of wordPairs) {
        const rawPair = pair.toObject ? pair.toObject() : pair;
        const correctAnswer = (rawPair.exactMatch && rawPair.exactMatch.length > 0)
            ? rawPair.exactMatch[0]
            : rawPair.word1;

        let distractors = [];

        if (rawPair.distractors && Array.isArray(rawPair.distractors) && rawPair.distractors.length >= 2) {
            distractors = rawPair.distractors.slice(0, 2);
        } else {
            const sameTypePairs = await WordPair.find({
                _id: { $ne: rawPair._id },
                expectedType: rawPair.expectedType,
                isActive: true,
            })
                .limit(15)
                .select('exactMatch word1')
                .lean();

            const pool = [];
            sameTypePairs.forEach((p) => {
                const val = (p.exactMatch && p.exactMatch[0]) || p.word1;
                if (val && normalizeText(val) !== normalizeText(correctAnswer)) {
                    pool.push(val);
                }
            });

            const uniquePool = Array.from(new Set(pool));
            if (uniquePool.length >= 2) {
                const shuffledPool = shuffleArray(uniquePool);
                distractors = [shuffledPool[0], shuffledPool[1]];
            } else {
                const typeKey = (rawPair.expectedType || 'nom').toLowerCase();
                const fallbacks = fallbackByType[typeKey] || fallbackByType.nom;
                const filteredFallbacks = fallbacks.filter(
                    (f) => normalizeText(f) !== normalizeText(correctAnswer)
                );
                const shuffledFallbacks = shuffleArray(filteredFallbacks);
                distractors = [shuffledFallbacks[0], shuffledFallbacks[1]];
            }
        }

        const formattedOptions = shuffleArray([
            correctAnswer,
            distractors[0],
            distractors[1],
        ]);

        enrichedList.push({
            _id: rawPair._id,
            word1: rawPair.word1,
            word2: rawPair.word2,
            clue: rawPair.clue,
            expectedType: rawPair.expectedType,
            difficulty: rawPair.difficulty,
            options: formattedOptions,
        });
    }

    return enrichedList;
};

const checkAnswerRealtime = async (userId, wordPairId, userAnswer, timeSpent) => {
    const pair = await WordPair.findById(wordPairId);
    if (!pair) throw createError('Énigme introuvable', 404);

    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    const existingPlayedWord = user.playedWords.find(
        (pw) => pw.word && pw.word.toString() === pair._id.toString()
    );

    if (!existingPlayedWord) {
        user.playedWords.push({
            word: pair._id,
            cooldownUntil: calculateCooldown(),
        });
    }

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
        user.kevs += earnedKevs;
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

            if (newLevel === 2 && user.referredBy && !user.referralRewardClaimed) {
                user.kevs += 100;
                user.referralRewardClaimed = true;
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
                    referrer.kevs += 500;
                    await referrer.save();
                }
            }
        }

        if (timeSpent <= 5) {
            timeWon = 10;
            points = Math.floor(points * 1.5);
        } else if (timeSpent <= 15) {
            timeWon = 6;
        } else {
            timeWon = 3;
        }
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
        leveledUp,
        newLevel,
        currentXp,
        xpNeeded: 3 + newLevel * 2,
        logicalHint: pair.clue,
    };
};

const validateFinalSession = async (userId, answers) => {
    const user = await User.findById(userId);
    if (!user) throw createError('Utilisateur introuvable', 404);

    if (!answers || !Array.isArray(answers)) {
        throw createError('Format de données invalide', 400);
    }

    let totalScore = 0;
    const corrections = [];

    for (const item of answers) {
        if (!item.wordPairId) continue;
        const pair = await WordPair.findById(item.wordPairId);
        if (!pair) continue;

        const userAnswer = normalizeText(item.answer);
        let points = 0;
        let isCorrect = false;

        const checkArray = (arr) =>
            arr && Array.isArray(arr) ? arr.map(normalizeText).includes(userAnswer) : false;

        if (checkArray(pair.exactMatch)) {
            points = 10;
            isCorrect = true;
        } else if (checkArray(pair.closeMatch)) {
            points = 8;
            isCorrect = true;
        } else if (checkArray(pair.partialMatch)) {
            points = 5;
            isCorrect = true;
        }

        if (isCorrect && item.timeSpent <= 5) {
            points = Math.floor(points * 1.5);
        }

        if (!isCorrect) {
            corrections.push({
                word1: pair.word1,
                word2: pair.word2,
                expectedAnswer: (pair.exactMatch && pair.exactMatch[0]) || 'Inconnu',
                userAnswer: item.answer || 'Non répondu',
            });
        }

        totalScore += points;
    }

    if (totalScore > user.bestScore) {
        user.bestScore = totalScore;
    }

    await user.save();

    return { totalScore, corrections };
};

module.exports = {
    enrichPairsWithOptions,
    checkAnswerRealtime,
    validateFinalSession,
};