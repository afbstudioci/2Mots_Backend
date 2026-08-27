//src/controllers/duelController.js
const { z } = require('zod');
const duelService = require('../services/duelService');
const DuelSession = require('../models/DuelSession');

const inviteSchema = z.object({
    opponentId: z.string().min(1, 'L\'identifiant de l\'adversaire est obligatoire.'),
    betAmount: z.number().int().min(10, 'La mise minimale est de 10 Kevs.').max(1000, 'La mise maximale est de 1000 Kevs.')
});

const respondSchema = z.object({
    duelId: z.string().min(1, 'L\'identifiant du duel est obligatoire.'),
    accept: z.boolean()
});

exports.getEligibleOpponents = async (req, res, next) => {
    try {
        const opponents = await duelService.getEligibleOpponents(req.user._id);
        res.status(200).json({
            status: 'success',
            data: opponents
        });
    } catch (error) {
        next(error);
    }
};

exports.getPendingInvites = async (req, res, next) => {
    try {
        const invites = await duelService.getUserInvites(req.user._id);
        res.status(200).json({
            status: 'success',
            data: invites
        });
    } catch (error) {
        next(error);
    }
};

exports.createInvite = async (req, res, next) => {
    try {
        const parsed = inviteSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                status: 'fail',
                message: parsed.error.issues[0]?.message || 'Données d\'invitation invalides.'
            });
        }

        const { opponentId, betAmount } = parsed.data;
        const duel = await duelService.createDuelInvite(req.user._id, opponentId, betAmount);

        const io = req.app.get('io');
        if (io) {
            io.to(String(opponentId)).emit('duel_invite_received', {
                duelId: String(duel._id),
                challengerName: req.user.login,
                betAmount
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Invitation de duel envoyée avec succès.',
            data: duel
        });
    } catch (error) {
        next(error);
    }
};

exports.respondInvite = async (req, res, next) => {
    try {
        const parsed = respondSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                status: 'fail',
                message: parsed.error.issues[0]?.message || 'Données de réponse invalides.'
            });
        }

        const { duelId, accept } = parsed.data;
        const result = await duelService.respondToDuelInvite(req.user._id, duelId, accept);

        const io = req.app.get('io');
        if (io && result) {
            const challengerId = result.challenger?._id || result.challenger;
            if (challengerId) {
                io.to(String(challengerId)).emit('duel_invite_response', {
                    duelId: String(result.duelId || result._id || duelId),
                    opponentName: req.user.login,
                    accept
                });
            }
        }

        res.status(200).json({
            status: 'success',
            message: accept ? 'Défi accepté ! La partie commence.' : 'Défi refusé.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

exports.getDuelDetails = async (req, res, next) => {
    try {
        const duel = await DuelSession.findById(req.params.id)
            .populate('challenger opponent winner', 'login avatar level')
            .lean();

        if (!duel) {
            return res.status(404).json({
                status: 'fail',
                message: 'Session de duel introuvable.'
            });
        }

        res.status(200).json({
            status: 'success',
            data: duel
        });
    } catch (error) {
        next(error);
    }
};

exports.cancelInvite = async (req, res, next) => {
    try {
        const { duelId } = req.body;
        if (!duelId) {
            return res.status(400).json({ status: 'fail', message: 'Identifiant du duel requis.' });
        }
        const result = await duelService.cancelDuelInvite(req.user._id, duelId);
        const io = req.app.get('io');
        if (io && result?.opponent) {
            io.to(String(result.opponent)).emit('duel_invite_cancelled', {
                duelId: String(duelId),
                opponentName: req.user.login
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Invitation annulée avec succès.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};
