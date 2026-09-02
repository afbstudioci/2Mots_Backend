const Friendship = require('../models/Friendship');
const User = require('../models/User');
const notificationService = require('./notificationService');
const presenceService = require('./presenceService');

const getFriendList = async (userId) => {
    const friendships = await Friendship.find({
        users: userId,
        status: 'accepted'
    }).populate('users', 'login avatar level lastActive').lean();

    return friendships
        .map(f => {
            const friend = f.users.find(u => u._id.toString() !== userId.toString());
            if (!friend) return null;
            return {
                ...friend,
                isOnline: presenceService.isUserOnline(friend._id)
            };
        })
        .filter(Boolean)
        .sort((a, b) => (b.isOnline - a.isOnline) || (b.level - a.level));
};

const getPendingRequests = async (userId) => {
    return await Friendship.find({
        users: userId,
        status: 'pending',
        requester: { $ne: userId }
    }).populate('requester', 'login avatar level');
};

const getSentRequests = async (userId) => {
    return await Friendship.find({
        users: userId,
        status: 'pending',
        requester: userId
    }).populate('users', 'login avatar level');
};

const sendFriendRequest = async (userId, targetId) => {
    if (userId.toString() === targetId.toString()) {
        throw new Error('Vous ne pouvez pas vous ajouter vous-même');
    }

    const existing = await Friendship.findOne({
        users: { $all: [userId, targetId] }
    });

    if (existing) {
        if (existing.status === 'accepted') throw new Error('Vous êtes déjà amis');
        if (existing.status === 'pending') throw new Error('Demande déjà en cours');
        if (existing.status === 'blocked') throw new Error('Action impossible');
    }

    const friendship = await Friendship.create({
        users: [userId, targetId],
        requester: userId,
        status: 'pending'
    });

    // Envoi de la notification push en arrière-plan
    try {
        const sender = await User.findById(userId).select('login').lean();
        if (sender) {
            notificationService.onFriendRequestSent(targetId, sender.login, userId).catch(() => {});
        }
    } catch (e) {
        console.warn('[FRIEND] Erreur push demande ami:', e.message);
    }

    return friendship;
};

const acceptFriendRequest = async (userId, requestId) => {
    const friendship = await Friendship.findById(requestId);
    if (!friendship) throw new Error('Demande introuvable');
    if (!friendship.users.includes(userId)) throw new Error('Action non autorisée');
    if (friendship.requester.toString() === userId.toString()) throw new Error('Vous ne pouvez pas accepter votre propre demande');

    friendship.status = 'accepted';
    const saved = await friendship.save();

    // Envoi de la notification push au demandeur
    try {
        const accepter = await User.findById(userId).select('login').lean();
        if (accepter) {
            notificationService.onFriendRequestAccepted(friendship.requester, accepter.login, userId).catch(() => {});
        }
    } catch (e) {
        console.warn('[FRIEND] Erreur push acceptation ami:', e.message);
    }

    return saved;
};

const rejectFriendRequest = async (userId, requestId) => {
    const friendship = await Friendship.findById(requestId);
    if (!friendship) throw new Error('Demande introuvable');
    if (!friendship.users.includes(userId)) throw new Error('Action non autorisée');

    return await Friendship.findByIdAndDelete(requestId);
};

const searchUsers = async (userId, query) => {
    if (!query) return [];
    return await User.find({
        _id: { $ne: userId },
        login: { $regex: query, $options: 'i' }
    }).select('login avatar level');
};

const blockUser = async (userId, targetId) => {
    let friendship = await Friendship.findOne({
        users: { $all: [userId, targetId] }
    });

    if (friendship) {
        friendship.status = 'blocked';
        return await friendship.save();
    }

    return await Friendship.create({
        users: [userId, targetId],
        requester: userId,
        status: 'blocked'
    });
};

module.exports = {
    getFriendList,
    getPendingRequests,
    getSentRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    searchUsers,
    blockUser
};