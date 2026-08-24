//src/controllers/gameController.js
const WordPair = require('../models/WordPair');
const gameService = require('../services/gameService');
const vaultService = require('../services/vaultService');
const leaderboardService = require('../services/leaderboardService');
const mongoose = require('mongoose');

const getBatch = async (req, res, next) => {
    try {
        const excludeQuery = req.query.exclude ? req.query.exclude.split(',').filter(Boolean) : [];
        const now = new Date();
        const played30Days = [
            ...(req.user?.playedWords || [])
                .filter(pw => pw.cooldownUntil && new Date(pw.cooldownUntil) > now)
                .map(pw => String(pw.word)),
            ...excludeQuery
        ];

        // 1. Tirage prioritaire ultra-rapide parmi la réserve authentique (par palier de niveau)
        let enrichedPairs = await vaultService.getEnigmaBatch(req.user?.level || 1, played30Days, 30);

        // 2. Verrouillage préventif immédiat : Dès que les 30 énigmes sont distribuées au joueur,
        // elles sont gravées dans l'historique 30 jours, même en cas de déconnexion ou crash !
        if (enrichedPairs && enrichedPairs.length > 0 && req.user) {
            gameService.recordPlayedWords(req.user, enrichedPairs.map(p => p._id));
            await req.user.save();
        }

        const rivalData = await leaderboardService.fetchNearbyRivals(req.user?._id, req.user?.bestScore || 0);
        const rivals = Array.isArray(rivalData) ? rivalData : (rivalData?.rivals || []);
        const userRank = rivalData?.userRank || 1;
        const threatBehind = rivalData?.threatBehind || null;

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
        const { answers, score, kevyKeys, bonusKevs, level, xp } = req.body;
        const result = await gameService.validateFinalSession(req.user._id, answers, score, kevyKeys, bonusKevs, level, xp);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

const syncLevel = async (req, res, next) => {
    try {
        const { level, xp, kevs } = req.body;
        const result = await gameService.syncLevel(req.user._id, level, xp, kevs);
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
    syncLevel,
    claimChest,
    syncKeys,
    syncOffline
};