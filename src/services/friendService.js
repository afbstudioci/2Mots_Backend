//src/services/friendService.js
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const pushService = require('./notificationService');

/**
 * Récupère la liste des amis acceptés
 */
exports.getFriendList = async (userId) => {
    const friendships = await Friendship.find({
        users: userId,
        status: 'accepted'
    }).populate('users', 'login avatar level status');

    return friendships.map(f => {
        const friend = f.users.find(u => u._id.toString() !== userId.toString());
        return {
            id: friend._id,
            name: friend.login,
            avatar: friend.avatar,
            level: friend.level,
            status: friend.status || 'offline'
        };
    });
};

/**
 * Récupère les demandes d'amis en attente
 */
exports.getPendingRequests = async (userId) => {
    return await Friendship.find({
        users: userId,
        status: 'pending',
        requester: { $ne: userId }
    }).populate('requester', 'login avatar level');
};

/**
 * Récupère les demandes envoyées par l'utilisateur
 */
exports.getSentRequests = async (userId) => {
    return await Friendship.find({
        requester: userId,
        status: 'pending'
    }).populate('users', 'login avatar level');
};

/**
 * Envoie une demande d'ami
 */
exports.sendFriendRequest = async (fromUserId, toUserId) => {
    if (fromUserId.toString() === toUserId.toString()) {
        throw new Error("Vous ne pouvez pas vous ajouter vous-même");
    }

    const existing = await Friendship.findOne({
        users: { $all: [fromUserId, toUserId] }
    });

    if (existing) {
        throw new Error("Une demande existe déjà ou vous êtes déjà amis");
    }

    const friendship = await Friendship.create({
        users: [fromUserId, toUserId],
        requester: fromUserId,
        status: 'pending'
    });

    // Notification push au destinataire
    const sender = await User.findById(fromUserId).select('login');
    pushService.onFriendRequestSent(toUserId, sender.login);

    return friendship;
};

/**
 * Accepte une demande d'ami
 */
exports.acceptFriendRequest = async (userId, requestId) => {
    const friendship = await Friendship.findById(requestId);
    
    if (!friendship || friendship.status !== 'pending') {
        throw new Error("Demande introuvable");
    }

    // Vérifier que c'est bien l'utilisateur destinataire qui accepte
    const isRecipient = friendship.users.some(u => u.toString() === userId.toString()) && 
                        friendship.requester.toString() !== userId.toString();

    if (!isRecipient) {
        throw new Error("Action non autorisée");
    }

    friendship.status = 'accepted';
    await friendship.save();

    // Notification push à celui qui avait envoyé la demande
    const accepter = await User.findById(userId).select('login');
    pushService.onFriendRequestAccepted(friendship.requester, accepter.login);

    return friendship;
};

/**
 * Recherche des utilisateurs par login
 */
exports.searchUsers = async (userId, query) => {
    if (!query) return [];

    return await User.find({
        login: { $regex: query, $options: 'i' },
        _id: { $ne: userId }
    }).select('login avatar level').limit(10);
};
/**
 * Bloque un utilisateur
 */
exports.blockUser = async (userId, targetId) => {
    return await Friendship.findOneAndUpdate(
        { users: { $all: [userId, targetId] } },
        { status: 'blocked', requester: userId },
        { upsert: true, new: true }
    );
};
