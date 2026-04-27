//src/services/chatService.js
const Message = require('../models/Message');
const pushService = require('./notificationService');

/**
 * Enregistre un nouveau message
 */
exports.saveMessage = async (senderId, recipientId, data) => {
    const { text, type, fileUrl, fileId, duration } = data;

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        type: type || 'text',
        fileUrl,
        fileId,
        duration
    });

    return await message.populate('sender', 'login avatar');
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
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('sender', 'login avatar');
};

/**
 * Envoie une notification push pour un nouveau message
 */
exports.sendPushNotification = async (recipientId, senderName, messageText, type) => {
    await pushService.onNewMessage(recipientId, senderName, messageText, type);
};

