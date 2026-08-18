//src/controllers/gameController.js
const WordPair = require('../models/WordPair');
const gameService = require('../services/gameService');

const getBatch = async (req, res, next) => {
    try {
        const playedWordIds = (req.user.playedWords || [])
            .filter(pw => pw.cooldownUntil && new Date() < new Date(pw.cooldownUntil))
            .map(pw => pw.word);

        let wordPairs = await WordPair.aggregate([
            { $match: { _id: { $nin: playedWordIds }, isActive: true } },
            { $sample: { size: 10 } }
        ]);

        if (!wordPairs || wordPairs.length === 0) {
            wordPairs = await WordPair.aggregate([
                { $match: { isActive: true } },
                { $sample: { size: 10 } }
            ]);
        }

        if (!wordPairs || wordPairs.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: [],
                userStats: {
                    level: req.user.level,
                    xp: req.user.xp,
                    xpNeeded: 3 + req.user.level * 2,
                    kevs: req.user.kevs
                }
            });
        }

        const enrichedPairs = await gameService.enrichPairsWithOptions(wordPairs);

        res.status(200).json({
            status: 'success',
            data: enrichedPairs,
            userStats: {
                level: req.user.level,
                xp: req.user.xp,
                xpNeeded: 3 + req.user.level * 2,
                kevs: req.user.kevs
            }
        });
    } catch (error) {
        next(error);
    }
};

const checkAnswer = async (req, res, next) => {
    try {
        const { wordPairId, answer, timeSpent } = req.body;
        const result = await gameService.checkAnswerRealtime(req.user._id, wordPairId, answer, timeSpent);
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const useHint = async (req, res, next) => {
    try {
        const result = await gameService.useHint(req.user._id);
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const validateSession = async (req, res, next) => {
    try {
        const { answers } = req.body;
        const result = await gameService.validateFinalSession(req.user._id, answers);
        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBatch,
    checkAnswer,
    useHint,
    validateSession
};