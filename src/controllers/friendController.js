//src/controllers/friendController.js
const friendService = require('../services/friendService');

exports.getFriends = async (req, res) => {
    try {
        const friends = await friendService.getFriendList(req.user.id);
        res.status(200).json({ status: 'success', data: friends });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getRequests = async (req, res) => {
    try {
        const requests = await friendService.getPendingRequests(req.user.id);
        res.status(200).json({ status: 'success', data: requests });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getSentRequests = async (req, res) => {
    try {
        const sent = await friendService.getSentRequests(req.user.id);
        res.status(200).json({ status: 'success', data: sent });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.sendRequest = async (req, res) => {
    try {
        await friendService.sendFriendRequest(req.user.id, req.params.id);
        res.status(201).json({ status: 'success', message: "Demande envoyée" });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.acceptRequest = async (req, res) => {
    try {
        await friendService.acceptFriendRequest(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: "Demande acceptée" });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.search = async (req, res) => {
    try {
        const users = await friendService.searchUsers(req.user.id, req.query.query);
        res.status(200).json({ status: 'success', data: users });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.blockUser = async (req, res) => {
    try {
        await friendService.blockUser(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: "Utilisateur bloqué" });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.useReferralCode = async (req, res) => {
    try {
        const { code } = req.body;
        const User = require('../models/User');
        
        const currentUser = await User.findById(req.user.id);
        if (currentUser.referredBy) {
            return res.status(400).json({ status: 'fail', message: "Vous avez déjà utilisé un code de parrainage" });
        }

        const inviter = await User.findOne({ referralCode: code });
        if (!inviter) {
            return res.status(404).json({ status: 'fail', message: "Code de parrainage invalide" });
        }

        if (inviter._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ status: 'fail', message: "Vous ne pouvez pas vous parrainer vous-même" });
        }

        // Récompenses
        inviter.kevs += 500;
        currentUser.kevs += 100;
        currentUser.referredBy = inviter._id;

        await inviter.save();
        await currentUser.save();

        res.status(200).json({ 
            status: 'success', 
            message: `Félicitations ! Vous avez reçu 100 Kevs et ${inviter.login} a reçu 500 Kevs.` 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
