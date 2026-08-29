//src/services/duelService.js
const DuelSession = require('../models/DuelSession');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const vaultService = require('./vaultService');
const notificationService = require('./notificationService');
const duelEngine = require('./duelEngine');

const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

exports.getEligibleOpponents = async (userId) => {
    const friendships = await Friendship.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: 'accepted'
    }).lean();

    const friendIds = friendships.map(f =>
        String(f.requester) === String(userId) ? f.recipient : f.requester
    );

    const eligibleUsers = await User.find({
        _id: { $ne: userId },
        level: { $gte: 5 },
        isBanned: false
    })
        .select('login avatar level bestScore isVip equippedFrame')
        .sort({ level: -1 })
        .limit(50)
        .lean();

    return eligibleUsers.map(user => ({
        ...user,
        isFriend: friendIds.some(fid => String(fid) === String(user._id))
    }));
};

exports.createDuelInvite = async (challengerId, opponentId, betAmount) => {
    if (String(challengerId) === String(opponentId)) {
        throw new Error('Vous ne pouvez pas vous défier vous-même.');
    }

    const [challenger, opponent] = await Promise.all([
        User.findById(challengerId),
        User.findById(opponentId)
    ]);

    if (!challenger || challenger.level < 5) {
        throw new Error('Vous devez être au moins au niveau 5 pour défier en duel.');
    }
    if (!opponent || opponent.level < 5) {
        throw new Error('L\'adversaire ciblé doit être au moins au niveau 5.');
    }
    if (challenger.kevs < betAmount) {
        throw new Error(`Solde insuffisant : vous avez ${challenger.kevs} Kevs (mise : ${betAmount}).`);
    }
    if (opponent.kevs < betAmount) {
        throw new Error(`L'adversaire n'a pas assez de Kevs (${opponent.kevs} Kevs) pour cette mise.`);
    }

    const existingPending = await DuelSession.findOne({
        challenger: challengerId,
        opponent: opponentId,
        status: 'pending'
    });
    if (existingPending) {
        throw new Error('Une invitation est déjà en attente pour cet adversaire.');
    }

    const duel = await DuelSession.create({
        challenger: challengerId,
        opponent: opponentId,
        betAmount,
        status: 'pending'
    });

    try {
        await notificationService.onDuelInvite(opponentId, challenger.login, betAmount, duel._id);
    } catch (e) {
        console.warn('[DUEL] Erreur notification push invitation:', e.message);
    }

    return duel;
};

exports.respondToDuelInvite = async (opponentId, duelId, accept) => {
    const duel = await DuelSession.findOne({ _id: duelId, opponent: opponentId, status: 'pending' })
        .populate('challenger', 'login avatar kevs level')
        .populate('opponent', 'login avatar kevs level');

    if (!duel) {
        throw new Error('Invitation de duel introuvable ou déjà traitée.');
    }

    if (!accept) {
        duel.status = 'rejected';
        duel.endedAt = new Date();
        await duel.save();
        try {
            await notificationService.onDuelRejected(duel.challenger._id, duel.opponent.login);
        } catch {}
        return { status: 'rejected', duelId: duel._id, challenger: duel.challenger };
    }

    const [challengerUser, opponentUser] = await Promise.all([
        User.findById(duel.challenger._id).select('kevs'),
        User.findById(duel.opponent._id).select('kevs')
    ]);

    if (!challengerUser || challengerUser.kevs < duel.betAmount) {
        duel.status = 'cancelled';
        await duel.save();
        throw new Error('Le challenger n\'a plus assez de Kevs pour ce duel.');
    }

    if (!opponentUser || opponentUser.kevs < duel.betAmount) {
        duel.status = 'cancelled';
        await duel.save();
        throw new Error('Vous n\'avez plus assez de Kevs pour accepter ce duel.');
    }

    const rawBatch = await vaultService.getEnigmaBatch(5, [], 20);
    const enigmas = (rawBatch || []).map((item, index) => {
        const answer = String(item.exactMatch?.[0] || item.answer || 'REPONSE').toUpperCase();
        const propositions = Array.isArray(item.options) && item.options.length >= 3
            ? item.options.map(p => String(p).toUpperCase())
            : shuffleArray([
                answer,
                String(item.distractors?.[0] || 'CHOIX1').toUpperCase(),
                String(item.distractors?.[1] || 'CHOIX2').toUpperCase()
            ]);

        return {
            enigmaId: String(item._id || `enigma_${index}`),
            word1: String(item.word1 || 'MOT1').toUpperCase(),
            word2: String(item.word2 || 'MOT2').toUpperCase(),
            answer,
            propositions,
            clue: String(item.clue || '')
        };
    });

    duel.status = 'ready';
    duel.totalPot = duel.betAmount * 2;
    duel.enigmas = enigmas;
    duel.currentEnigmaIndex = 0;
    duel.startedAt = null;
    await duel.save();

    try {
        await notificationService.onDuelAccepted(duel.challenger._id, duel.opponent.login, duel._id);
    } catch {}

    return duel;
};

exports.getActiveDuel = async (userId) => {
    const activeDuel = await DuelSession.findOne({
        $or: [{ challenger: userId }, { opponent: userId }],
        status: { $in: ['ready', 'in_progress'] }
    })
        .populate('challenger opponent', 'login avatar level isVip equippedFrame')
        .sort({ updatedAt: -1 })
        .lean();

    if (!activeDuel) return null;

    const now = Date.now();
    if (activeDuel.status === 'in_progress' && activeDuel.startedAt) {
        const elapsed = (now - new Date(activeDuel.startedAt).getTime()) / 1000;
        if (elapsed > ((activeDuel.duration || 60) + 20)) {
            await duelEngine.finishDuel(activeDuel._id);
            return null;
        }
    } else if (activeDuel.status === 'ready') {
        const waitElapsed = (now - new Date(activeDuel.updatedAt || activeDuel.createdAt).getTime()) / 1000;
        if (waitElapsed > 180) {
            await exports.cancelInactiveDuel(userId, activeDuel._id);
            return null;
        }
    }

    return activeDuel;
};

exports.getUserInvites = async (userId) => {
    const [received, sent] = await Promise.all([
        DuelSession.find({ opponent: userId, status: 'pending' })
            .populate('challenger', 'login avatar level isVip equippedFrame')
            .sort({ createdAt: -1 })
            .lean(),
        DuelSession.find({ challenger: userId, status: 'pending' })
            .populate('opponent', 'login avatar level isVip equippedFrame')
            .sort({ createdAt: -1 })
            .lean()
    ]);
    return { received, sent };
};

exports.cancelDuelInvite = async (challengerId, duelId) => {
    const duel = await DuelSession.findOne({ _id: duelId, challenger: challengerId, status: 'pending' });
    if (!duel) {
        throw new Error('Invitation introuvable ou déjà traitée.');
    }
    duel.status = 'cancelled';
    duel.endedAt = new Date();
    await duel.save();
    return { status: 'cancelled', duelId: duel._id, opponent: duel.opponent };
};

exports.cancelInactiveDuel = async (userId, duelId) => {
    const duel = await DuelSession.findOne({
        _id: duelId,
        $or: [{ challenger: userId }, { opponent: userId }],
        status: { $in: ['ready', 'pending'] }
    });

    if (!duel) {
        throw new Error('Duel introuvable ou déjà démarré.');
    }

    if (duel.status === 'ready') {
        await Promise.all([
            User.updateOne({ _id: duel.challenger }, { $inc: { kevs: duel.betAmount } }),
            User.updateOne({ _id: duel.opponent }, { $inc: { kevs: duel.betAmount } })
        ]);
    }

    duel.status = 'cancelled';
    duel.endedAt = new Date();
    await duel.save();

    return duel;
};

// Re-export arena gameplay engine methods
exports.startDuelGame = duelEngine.startDuelGame;
exports.handleBuzzer = duelEngine.handleBuzzer;
exports.releaseBuzzer = duelEngine.releaseBuzzer;
exports.submitAnswer = duelEngine.submitAnswer;
exports.skipEnigma = duelEngine.skipEnigma;
exports.finishDuel = duelEngine.finishDuel;
