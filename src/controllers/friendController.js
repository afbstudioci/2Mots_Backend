//src/controllers/friendController.js
const Friend = require('../models/Friend');
const User = require('../models/User');

exports.sendRequest = async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.user.id;

        if (senderId === recipientId) {
            return res.status(400).json({ status: 'fail', message: 'Impossible de s\'ajouter soi-même en ami.' });
        }

        const existing = await Friend.findOne({
            $or: [
                { requester: senderId, recipient: recipientId },
                { requester: recipientId, recipient: senderId }
            ]
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ status: 'fail', message: 'Vous êtes déjà amis.' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ status: 'fail', message: 'Une demande est déjà en attente.' });
            }
            if (existing.status === 'blocked') {
                return res.status(403).json({ status: 'fail', message: 'Action impossible.' });
            }
        }

        const newFriendship = await Friend.create({
            requester: senderId,
            recipient: recipientId,
            status: 'pending'
        });

        return res.status(201).json({ status: 'success', data: { friendship: newFriendship } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.acceptRequest = async (req, res) => {
    try {
        const { friendshipId } = req.body;
        const friendship = await Friend.findById(friendshipId);

        if (!friendship || friendship.recipient.toString() !== req.user.id) {
            return res.status(404).json({ status: 'fail', message: 'Demande introuvable.' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        return res.status(200).json({ status: 'success', data: { friendship } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getFriendsList = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendships = await Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        }).populate('requester recipient', 'login avatar level rank status lastSeen isVip');

        const friends = friendships.map(f => {
            const isRequester = f.requester._id.toString() === userId;
            const friendData = isRequester ? f.recipient : f.requester;
            return {
                friendshipId: f._id,
                ...friendData.toObject()
            };
        });

        return res.status(200).json({ status: 'success', data: { friends } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.search = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim().length === 0) {
            return res.status(200).json({ status: 'success', data: { users: [] } });
        }

        const users = await User.find({
            login: { $regex: query, $options: 'i' },
            _id: { $ne: req.user.id }
        }).select('login avatar level rank isVip').limit(20);

        return res.status(200).json({ status: 'success', data: { users } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        await Friend.findOneAndUpdate(
            {
                $or: [
                    { requester: req.user.id, recipient: id },
                    { requester: id, recipient: req.user.id }
                ]
            },
            { status: 'blocked', requester: req.user.id, recipient: id },
            { upsert: true, new: true }
        );
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