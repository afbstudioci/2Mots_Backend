const WordPair = require('../models/WordPair');
const User = require('../models/User');

const fetchGameBatch = async () => {
    const batch = await WordPair.aggregate([{ $sample: { size: 50 } }]);
    return batch;
};

const validateAnswer = async (wordPairId, userAnswer, timeRemaining) => {
    const wordPair = await WordPair.findById(wordPairId);
    if (!wordPair) {
        throw new Error('Enigme introuvable');
    }

    const normalizedAnswer = userAnswer.toLowerCase().trim();
    const matchedAnswer = wordPair.answers.find(a => a.word.toLowerCase() === normalizedAnswer);

    if (!matchedAnswer) {
        return {
            isCorrect: false,
            points: 0,
            accuracy: 0,
            logicalHint: wordPair.logicalHint
        };
    }

    let points = 0;
    if (matchedAnswer.accuracy === 100) points = 10;
    else if (matchedAnswer.accuracy === 80) points = 8;
    else if (matchedAnswer.accuracy === 50) points = 5;

    let isCombo = false;
    if (timeRemaining > 7) {
        isCombo = true;
        points += 5;
    }

    return {
        isCorrect: true,
        points,
        accuracy: matchedAnswer.accuracy,
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
    fetchGameBatch,
    validateAnswer,
    updateBestScore
};