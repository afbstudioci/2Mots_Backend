// src/services/duelEngine.js
// MOTEUR D'EXECUTION ET D'ARBITRAGE DES DUELS TEMPS REEL
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const DuelSession = require('../models/DuelSession');
const User = require('../models/User');
const happyHourService = require('./happyHourService');
const presenceService = require('./presenceService');

exports.startDuelGame = async (duelId) => {
    const duel = await DuelSession.findById(duelId)
        .populate('challenger opponent winner', 'login avatar level');

    if (!duel) return null;
    if (duel.status === 'ready' || duel.status === 'in_progress') {
        if (!duel.startedAt) {
            duel.status = 'in_progress';
            duel.startedAt = new Date();
            await duel.save();
        }
    }
    return duel;
};

exports.handleBuzzer = async (duelId, userId) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3200);

    const duel = await DuelSession.findOneAndUpdate(
        {
            _id: duelId,
            status: { $in: ['in_progress', 'ready'] },
            $or: [
                { 'activeBuzzer.expiresAt': null },
                { 'activeBuzzer.expiresAt': { $lt: now } },
                { 'activeBuzzer.userId': null }
            ]
        },
        {
            $set: {
                activeBuzzer: {
                    userId,
                    lockedAt: now,
                    expiresAt
                }
            }
        },
        { new: true }
    ).populate('activeBuzzer.userId', 'login');

    return duel;
};

exports.releaseBuzzer = async (duelId) => {
    return await DuelSession.findByIdAndUpdate(
        duelId,
        {
            $set: {
                activeBuzzer: { userId: null, lockedAt: null, expiresAt: null }
            }
        },
        { new: true }
    );
};

exports.submitAnswer = async (duelId, userId, answer) => {
    const duel = await DuelSession.findOne({ _id: duelId, status: 'in_progress' });
    if (!duel) throw new Error('Duel introuvable ou termine.');

    if (!duel.activeBuzzer?.userId || String(duel.activeBuzzer.userId) !== String(userId)) {
        throw new Error('Vous n\'avez pas la main sur le buzzer.');
    }

    const currentEnigma = duel.enigmas[duel.currentEnigmaIndex];
    if (!currentEnigma) throw new Error('Enigme actuelle introuvable.');

    const isCorrect = String(answer || '').trim().toUpperCase() === String(currentEnigma.answer).trim().toUpperCase();
    const isChallenger = String(userId) === String(duel.challenger);

    if (isCorrect) {
        if (isChallenger) {
            duel.scores.challenger += 10;
        } else {
            duel.scores.opponent += 10;
        }
        duel.currentEnigmaIndex += 1;
    }
    duel.activeBuzzer = { userId: null, lockedAt: null, expiresAt: null };

    const isLastEnigma = duel.currentEnigmaIndex >= duel.enigmas.length;
    await duel.save();

    return {
        isCorrect,
        scores: duel.scores,
        currentEnigmaIndex: duel.currentEnigmaIndex,
        nextEnigma: isLastEnigma ? null : duel.enigmas[duel.currentEnigmaIndex],
        isLastEnigma
    };
};

exports.skipEnigma = async (duelId) => {
    const duel = await DuelSession.findOne({ _id: duelId, status: 'in_progress' });
    if (!duel) return null;

    duel.currentEnigmaIndex += 1;
    duel.activeBuzzer = { userId: null, lockedAt: null, expiresAt: null };

    const isLastEnigma = duel.currentEnigmaIndex >= duel.enigmas.length;
    await duel.save();

    return {
        scores: duel.scores,
        currentEnigmaIndex: duel.currentEnigmaIndex,
        nextEnigma: isLastEnigma ? null : duel.enigmas[duel.currentEnigmaIndex],
        isLastEnigma
    };
};

exports.finishDuel = async (duelId) => {
    const duel = await DuelSession.findOne({ _id: duelId, status: { $in: ['in_progress', 'ready', 'pending'] } });
    if (!duel) {
        return await DuelSession.findById(duelId).populate('challenger opponent winner', 'login avatar level');
    }

    duel.status = 'completed';
    duel.endedAt = new Date();

    const multiplier = happyHourService.getHappyHourMultiplier();
    const winXp = 50 * multiplier;

    if (duel.scores.challenger > duel.scores.opponent) {
        duel.winner = duel.challenger;
        duel.isDraw = false;
        const [uOpp, uChal] = await Promise.all([
            User.findByIdAndUpdate(duel.opponent, { $inc: { kevs: -duel.betAmount } }, { new: true }),
            User.findByIdAndUpdate(duel.challenger, { $inc: { kevs: duel.betAmount, xp: winXp } }, { new: true })
        ]);
        if (uOpp) presenceService.emitBalanceUpdate(duel.opponent, uOpp);
        if (uChal) presenceService.emitBalanceUpdate(duel.challenger, uChal);
    } else if (duel.scores.opponent > duel.scores.challenger) {
        duel.winner = duel.opponent;
        duel.isDraw = false;
        const [uChal, uOpp] = await Promise.all([
            User.findByIdAndUpdate(duel.challenger, { $inc: { kevs: -duel.betAmount } }, { new: true }),
            User.findByIdAndUpdate(duel.opponent, { $inc: { kevs: duel.betAmount, xp: winXp } }, { new: true })
        ]);
        if (uChal) presenceService.emitBalanceUpdate(duel.challenger, uChal);
        if (uOpp) presenceService.emitBalanceUpdate(duel.opponent, uOpp);
    } else {
        duel.isDraw = true;
        duel.winner = null;
    }

    await duel.save();
    return await DuelSession.findById(duelId).populate('challenger opponent winner', 'login avatar level');
};
