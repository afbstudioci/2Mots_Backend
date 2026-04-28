//src/services/chatService.js
const Message = require('../models/Message');
const pushService = require('./notificationService');

/**
 * Enregistre un nouveau message
 */
exports.saveMessage = async (senderId, recipientId, data) => {
    const { text, type, fileUrl, fileId, duration, replyTo } = data;

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        type: type || 'text',
        fileUrl,
        fileId,
        duration,
        status: 'sent',
        read: false,
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
    .sort({ createdAt: -1 }) // Inversed for easier frontend handling
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
    message.isDeleted = true;
    message.fileUrl = null;
    message.fileId = null;
    return await message.save();
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
 * Récupère la liste des conversations pour un utilisateur
 */
exports.getConversationList = async (userId) => {
    // Cette version simplifiée utilise l'agrégation pour trouver le dernier message par interlocuteur
    const conversations = await Message.aggregate([
        {
            $match: {
                $or: [{ sender: userId }, { recipient: userId }]
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: {
                    $cond: [
                        { $eq: ["$sender", userId] },
                        "$recipient",
                        "$sender"
                    ]
                },
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ["$recipient", userId] }, { $eq: ["$read", false] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'friend'
            }
        },
        { $unwind: '$friend' },
        {
            $project: {
                friend: { _id: 1, login: 1, avatar: 1 },
                lastMessage: 1,
                unreadCount: 1
            }
        },
        { $sort: { "lastMessage.createdAt": -1 } }
    ]);
    return conversations;
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
        { sender: friendId, recipient: userId, read: false },
        { $set: { read: true, status: 'read' } }
    );
};

/**
 * Compte le nombre total de messages non lus pour un utilisateur
 */
exports.getGlobalUnreadCount = async (userId) => {
    return await Message.countDocuments({ recipient: userId, read: false });
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
