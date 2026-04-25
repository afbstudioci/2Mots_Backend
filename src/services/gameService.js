const WordPair = require('../models/WordPair');
const User = require('../models/User');

const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const validateAnswer = async (wordPairId, userAnswer, timeRemaining) => {
    const wordPair = await WordPair.findById(wordPairId);
    if (!wordPair) {
        throw new Error('Enigme introuvable');
    }

    const normalizedAnswer = normalizeText(userAnswer);

    let isCorrect = false;
    let points = 0;
    let accuracy = 0;

    // Verification dans l'ordre : exact -> close -> partial
    if (wordPair.exactMatch.map(normalizeText).includes(normalizedAnswer)) {
        isCorrect = true;
        points = 10;
        accuracy = 100;
    } else if (wordPair.closeMatch.map(normalizeText).includes(normalizedAnswer)) {
        isCorrect = true;
        points = 8;
        accuracy = 80;
    } else if (wordPair.partialMatch.map(normalizeText).includes(normalizedAnswer)) {
        isCorrect = true;
        points = 5;
        accuracy = 50;
    }

    if (!isCorrect) {
        return {
            isCorrect: false,
            points: 0,
            accuracy: 0,
            logicalHint: wordPair.logicalHint || wordPair.clue
        };
    }

    // Bonus de temps (si plus de 20 secondes restantes sur 30)
    let isCombo = false;
    if (timeRemaining > 20) {
        isCombo = true;
        points += 5;
    }

    return {
        isCorrect,
        points,
        accuracy,
        isCombo
    };
};

const updateBestScore = async (userId, newScore) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('Utilisateur introuvable');

    if (newScore > user.bestScore) {
        user.bestScore = newScore;
        await user.save({ validateBeforeSave: false });
        return { isNewRecord: true, bestScore: user.bestScore };
    }

    return { isNewRecord: false, bestScore: user.bestScore };
};

module.exports = {
    validateAnswer,
    updateBestScore
};