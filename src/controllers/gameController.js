//src/controllers/gameController.js
const WordPair = require('../models/WordPair');
const gameService = require('../services/gameService');
const leaderboardService = require('../services/leaderboardService');
const mongoose = require('mongoose');

const getBatch = async (req, res, next) => {
    try {
        const excludeQuery = req.query.exclude ? req.query.exclude.split(',').filter(Boolean) : [];
        const clientExcludeObjectIds = excludeQuery
            .map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return null; }
            })
            .filter(Boolean);

        const playedWordIds = (req.user?.playedWords || [])
            .filter(pw => pw.cooldownUntil && new Date() < new Date(pw.cooldownUntil))
            .map(pw => pw.word);

        const allExcludedIds = [...new Set([...playedWordIds.map(String), ...clientExcludeObjectIds.map(String)])]
            .map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return null; }
            })
            .filter(Boolean);

        let wordPairs = await WordPair.aggregate([
            { $match: { _id: { $nin: allExcludedIds }, isActive: true } },
            { $sample: { size: 30 } }
        ]);

        if (!wordPairs || wordPairs.length < 10) {
            wordPairs = await WordPair.aggregate([
                { $match: { _id: { $nin: clientExcludeObjectIds }, isActive: true } },
                { $sample: { size: 30 } }
            ]);
        }

        if (!wordPairs || wordPairs.length === 0) {
            wordPairs = await WordPair.aggregate([
                { $match: { isActive: true } },
                { $sample: { size: 30 } }
            ]);
        }

        const rivalData = await leaderboardService.fetchNearbyRivals(req.user?._id, req.user?.bestScore || 0);
        const rivals = Array.isArray(rivalData) ? rivalData : (rivalData?.rivals || []);
        const userRank = rivalData?.userRank || 1;
        const threatBehind = rivalData?.threatBehind || null;

        if (!wordPairs || wordPairs.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: [],
                rivals,
                userRank,
                threatBehind,
                userStats: {
                    level: req.user.level,
                    xp: req.user.xp,
                    xpNeeded: 3 + req.user.level * 2,
                    kevs: req.user.kevs,
                    kevyKeys: req.user.kevyKeys || 0
                }
            });
        }

        const enrichedPairs = await gameService.enrichPairsWithOptions(wordPairs);

        res.status(200).json({
            status: 'success',
            data: enrichedPairs,
            rivals,
            userRank,
            threatBehind,
            userStats: {
                level: req.user.level,
                xp: req.user.xp,
                xpNeeded: 3 + req.user.level * 2,
                kevs: req.user.kevs,
                kevyKeys: req.user.kevyKeys || 0
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
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const useHint = async (req, res, next) => {
    try {
        const result = await gameService.useHint(req.user._id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const validateSession = async (req, res, next) => {
    try {
        const { answers, score, kevyKeys, bonusKevs } = req.body;
        const result = await gameService.validateFinalSession(req.user._id, answers, score, kevyKeys, bonusKevs);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const claimChest = async (req, res, next) => {
    try {
        const { gains } = req.body;
        const result = await gameService.claimChestReward(req.user._id, gains);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const syncKeys = async (req, res, next) => {
    try {
        const { kevyKeys } = req.body;
        const result = await gameService.syncUserKeys(req.user._id, kevyKeys);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const syncOffline = async (req, res, next) => {
    try {
        const result = await gameService.syncOfflineSession(req.user._id, req.body);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBatch,
    checkAnswer,
    useHint,
    validateSession,
    claimChest,
    syncKeys,
    syncOffline
};