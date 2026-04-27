//src/services/chatService.js
const Message = require('../models/Message');
const User = require('../models/User');
const admin = require('../config/firebase');

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
 * Envoie une notification push via Firebase
 */
exports.sendPushNotification = async (recipientId, senderName, messageText, type) => {
    try {
        const user = await User.findById(recipientId);
        if (!user || !user.fcmToken) return;

        const payload = {
            notification: {
                title: senderName,
                body: type === 'text' ? messageText : `A envoyé un ${type}`,
                sound: 'default',
            },
            data: {
                type: 'chat_message',
                senderName: senderName,
            },
            token: user.fcmToken
        };

        await admin.messaging().send(payload);
        console.log(`Notification envoyée à ${user.login}`);
    } catch (error) {
        console.error("Erreur Push Notification:", error);
    }
};
