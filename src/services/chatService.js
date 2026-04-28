//src/services/chatService.js
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const pushService = require('./notificationService');

/**
 * Enregistre un nouveau message
 */
exports.saveMessage = async (senderId, recipientId, data) => {
    const { text, type, fileUrl, fileId, duration, replyTo } = data;

    const friendship = await Friendship.findOne({
        users: { $all: [senderId, recipientId] }
    });

    if (friendship) {
        const recipientSettings = friendship.settings.get(recipientId.toString());
        const senderSettings = friendship.settings.get(senderId.toString());

        if (recipientSettings && recipientSettings.isBlocked) {
            throw new Error('Vous avez été bloqué par cet utilisateur.');
        }
        if (senderSettings && senderSettings.isBlocked) {
            throw new Error('Vous avez bloqué cet utilisateur.');
        }
    }

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        type: type || 'text',
        fileUrl,
        fileId,
        duration,
        status: 'sent',
        isRead: false,
        replyTo: replyTo || null
    });

    return await message.populate([
        { path: 'sender', select: 'login avatar' },
        { path: 'replyTo' }
    ]);
};

/**
 * Récupère l'historique entre deux utilisateurs
 */
exports.getChatHistory = async (userId, otherUserId, limit = 50) => {
    return await Message.find({
        $or: [
            { sender: userId, recipient: otherUserId },
            { sender: otherUserId, recipient: userId }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate([
            { path: 'sender', select: 'login avatar' },
            { path: 'replyTo' }
        ]);
};

/**
 * Édite un message (Fenêtre de 24h)
 */
exports.editMessage = async (messageId, userId, newText) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message non trouvé');
    if (message.sender.toString() !== userId.toString()) throw new Error('Non autorisé');

    const diff = Date.now() - new Date(message.createdAt).getTime();
    if (diff > 24 * 60 * 60 * 1000) throw new Error('Délai de 24h dépassé');

    message.editHistory.push({ text: message.text, editedAt: new Date() });
    message.text = newText;
    message.isEdited = true;
    return await message.save();
};

/**
 * Supprime un message pour les deux interlocuteurs
 */
exports.deleteMessage = async (messageId, userId) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message non trouvé');
    if (message.sender.toString() !== userId.toString()) throw new Error('Non autorisé');

    message.text = 'Ce message a été supprimé';
    message.isDeletedForEveryone = true;
    message.fileUrl = null;
    message.fileId = null;
    message.type = 'text';
    message.expireAt = new Date();
    return await message.save();
};

/**
 * Met à jour les paramètres d'une discussion spécifique
 */
exports.updateChatSettings = async (userId, friendId, settings) => {
    const friendship = await Friendship.findOne({
        users: { $all: [userId, friendId] }
    });

    if (!friendship) throw new Error('Relation non trouvée');

    const userSettings = friendship.settings.get(userId.toString()) || { muteNotifications: false, theme: 'default', isBlocked: false };

    if (settings.muteNotifications !== undefined) userSettings.muteNotifications = settings.muteNotifications;
    if (settings.theme !== undefined) userSettings.theme = settings.theme;
    if (settings.isBlocked !== undefined) userSettings.isBlocked = settings.isBlocked;

    friendship.settings.set(userId.toString(), userSettings);
    await friendship.save();
    return userSettings;
};

/**
 * Récupère les paramètres d'une discussion
 */
exports.getChatSettings = async (userId, friendId) => {
    const friendship = await Friendship.findOne({
        users: { $all: [userId, friendId] }
    });

    if (!friendship) return { muteNotifications: false, theme: 'default', isBlocked: false };
    return friendship.settings.get(userId.toString()) || { muteNotifications: false, theme: 'default', isBlocked: false };
};

/**
 * Ajoute ou retire une réaction
 */
exports.toggleReaction = async (messageId, userId, emoji) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message non trouvé');

    const index = message.reactions.findIndex(r => r.user.toString() === userId.toString() && r.emoji === emoji);
    if (index > -1) {
        message.reactions.splice(index, 1);
    } else {
        message.reactions.push({ user: userId, emoji });
    }
    return await message.save();
};

/**
 * Récupère la liste des conversations pour un utilisateur (avec pré-chargement)
 */
exports.getConversationList = async (userId) => {
    const objectIdUser = new mongoose.Types.ObjectId(userId);

    const friendships = await Friendship.find({
        users: userId,
        status: 'accepted'
    }).populate('users', 'login avatar level');

    const friends = friendships
        .map(f => f.users.find(u => u && u._id.toString() !== userId.toString()))
        .filter(friend => friend);

    const conversationsData = await Message.aggregate([
        {
            $match: {
                $or: [{ sender: objectIdUser }, { recipient: objectIdUser }]
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: {
                    $cond: [
                        { $eq: ["$sender", objectIdUser] },
                        "$recipient",
                        "$sender"
                    ]
                },
                recentMessages: { $push: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ["$recipient", objectIdUser] }, { $eq: ["$isRead", false] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                recentMessages: { $slice: ["$recentMessages", 20] },
                unreadCount: 1
            }
        }
    ]);

    const fullConversations = friends.map(friend => {
        const data = conversationsData.find(d => d._id.toString() === friend._id.toString());
        return {
            friend: {
                _id: friend._id,
                login: friend.login,
                avatar: friend.avatar,
                level: friend.level
            },
            recentMessages: data ? data.recentMessages : [],
            lastMessage: data && data.recentMessages.length > 0 ? data.recentMessages[0] : null,
            unreadCount: data ? data.unreadCount : 0
        };
    });

    return fullConversations.sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });
};

/**
 * Envoie une notification push pour un nouveau message
 */
exports.sendPushNotification = async (recipientId, senderName, messageText, type) => {
    await pushService.onNewMessage(recipientId, senderName, messageText, type);
};

/**
 * Marque tous les messages d'une discussion comme lus
 */
exports.markMessagesAsRead = async (userId, friendId) => {
    return await Message.updateMany(
        { sender: friendId, recipient: userId, isRead: false },
        { $set: { isRead: true, status: 'read' } }
    );
};

/**
 * Compte le nombre total de messages non lus pour un utilisateur
 */
exports.getGlobalUnreadCount = async (userId) => {
    return await Message.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Supprime tous les messages entre deux utilisateurs
 */
exports.clearChatHistory = async (userId, otherUserId) => {
    return await Message.deleteMany({
        $or: [
            { sender: userId, recipient: otherUserId },
            { sender: otherUserId, recipient: userId }
        ]
    });
};