//src/controllers/friendController.js
const friendService = require('../services/friendService');
const User = require('../models/User');

exports.getFriends = async (req, res) => {
    try {
        const friends = await friendService.getFriendList(req.user.id);
        return res.status(200).json({ status: 'success', data: { friends } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getRequests = async (req, res) => {
    try {
        const requests = await friendService.getPendingRequests(req.user.id);
        return res.status(200).json({ status: 'success', data: { requests } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getSentRequests = async (req, res) => {
    try {
        const sentRequests = await friendService.getSentRequests(req.user.id);
        return res.status(200).json({ status: 'success', data: { sentRequests } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.sendRequest = async (req, res) => {
    try {
        const recipientId = req.params.id || req.body.recipientId || req.body.targetId;
        if (!recipientId) {
            return res.status(400).json({ status: 'fail', message: 'Destinataire manquant.' });
        }
        const friendship = await friendService.sendFriendRequest(req.user.id, recipientId);
        return res.status(201).json({ status: 'success', data: { friendship } });
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.acceptRequest = async (req, res) => {
    try {
        const requestId = req.params.id || req.body.friendshipId || req.body.requestId;
        const friendship = await friendService.acceptFriendRequest(req.user.id, requestId);
        return res.status(200).json({ status: 'success', data: { friendship } });
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.rejectRequest = async (req, res) => {
    try {
        const requestId = req.params.id || req.body.friendshipId || req.body.requestId;
        await friendService.rejectFriendRequest(req.user.id, requestId);
        return res.status(200).json({ status: 'success', message: 'Demande rejetée.' });
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.search = async (req, res) => {
    try {
        const { query } = req.query;
        const users = await friendService.searchUsers(req.user.id, query);
        return res.status(200).json({ status: 'success', data: { users } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.blockUser = async (req, res) => {
    try {
        const targetId = req.params.id || req.body.targetId;
        await friendService.blockUser(req.user.id, targetId);
        return res.status(200).json({ status: 'success', message: 'Utilisateur bloqué.' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.useReferralCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || !code.trim()) {
            return res.status(400).json({ status: 'fail', message: 'Veuillez saisir un code.' });
        }

        const currentUser = await User.findById(req.user.id);
        if (!currentUser) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        if (currentUser.referredBy) {
            return res.status(400).json({ status: 'fail', message: 'Vous avez déjà utilisé un code de parrainage.' });
        }

        const inviter = await User.findOne({ referralCode: code.trim().toUpperCase() });
        if (!inviter) {
            return res.status(404).json({ status: 'fail', message: 'Code de parrainage invalide.' });
        }

        if (inviter._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ status: 'fail', message: 'Vous ne pouvez pas vous parrainer vous-même.' });
        }

        inviter.kevs = (inviter.kevs || 0) + 500;
        currentUser.kevs = (currentUser.kevs || 0) + 200;
        currentUser.referredBy = inviter._id;

        await inviter.save();
        await currentUser.save();

        return res.status(200).json({
            status: 'success',
            message: `Félicitations ! Vous avez reçu 200 Kevs bonus et ${inviter.login} a reçu 500 Kevs.`
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};