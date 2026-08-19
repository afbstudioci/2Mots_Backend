//src/services/chatService.js
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
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
            throw new Error('Vous avez ete bloque par cet utilisateur.');
        }
        if (senderSettings && senderSettings.isBlocked) {
            throw new Error('Vous avez bloque cet utilisateur.');
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
 * Recupere l'historique entre deux utilisateurs
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
 * Edite un message (Fenetre de 24h)
 */
exports.editMessage = async (messageId, userId, newText) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message non trouve');
    if (message.sender.toString() !== userId.toString()) throw new Error('Non autorise');

    const diff = Date.now() - new Date(message.createdAt).getTime();
    if (diff > 24 * 60 * 60 * 1000) throw new Error('Delai de 24h depasse');

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
    if (!message) throw new Error('Message non trouve');
    if (message.sender.toString() !== userId.toString()) throw new Error('Non autorise');

    message.text = 'Ce message a ete supprime';
    message.isDeletedForEveryone = true;
    message.fileUrl = null;
    message.fileId = null;
    message.type = 'text';
    message.expireAt = new Date();
    return await message.save();
};

/**
 * Met a jour les parametres d'une discussion specifique
 */
exports.updateChatSettings = async (userId, friendId, settings) => {
    const friendship = await Friendship.findOne({
        users: { $all: [userId, friendId] }
    });

    if (!friendship) throw new Error('Relation non trouvee');

    const userSettings = friendship.settings.get(userId.toString()) || { muteNotifications: false, theme: 'default', isBlocked: false };

    if (settings.muteNotifications !== undefined) userSettings.muteNotifications = settings.muteNotifications;
    if (settings.theme !== undefined) userSettings.theme = settings.theme;
    if (settings.isBlocked !== undefined) userSettings.isBlocked = settings.isBlocked;

    friendship.settings.set(userId.toString(), userSettings);
    await friendship.save();
    return userSettings;
};

/**
 * Recupere les parametres d'une discussion
 */
exports.getChatSettings = async (userId, friendId) => {
    const friendship = await Friendship.findOne({
        users: { $all: [userId, friendId] }
    });

    if (!friendship) return { muteNotifications: false, theme: 'default', isBlocked: false };
    return friendship.settings.get(userId.toString()) || { muteNotifications: false, theme: 'default', isBlocked: false };
};

/**
 * Ajoute ou retire une reaction
 */
exports.toggleReaction = async (messageId, userId, emoji) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message non trouve');

    const index = message.reactions.findIndex(r => r.user.toString() === userId.toString() && r.emoji === emoji);
    if (index > -1) {
        message.reactions.splice(index, 1);
    } else {
        message.reactions.push({ user: userId, emoji });
    }
    return await message.save();
};

/**
 * Recupere la liste des conversations pour un utilisateur (avec pre-chargement et support complet des amis + messages)
 */
exports.getConversationList = async (userId) => {
    const uid = userId.toString();
    const objectIdUser = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // 1. Recupere tous les amis acceptes
    const friendships = await Friendship.find({
        users: userId,
        status: 'accepted'
    }).populate('users', 'login avatar level');

    const friendsMap = new Map();
    friendships.forEach(f => {
        const friendObj = f.users.find(u => u && u._id.toString() !== uid);
        if (friendObj) {
            friendsMap.set(friendObj._id.toString(), {
                _id: friendObj._id,
                login: friendObj.login,
                avatar: friendObj.avatar,
                level: friendObj.level || 1
            });
        }
    });

    // 2. Trouve tous les messages de l'utilisateur
    const recentMessages = await Message.find({
        $or: [{ sender: objectIdUser }, { recipient: objectIdUser }]
    }).sort({ createdAt: -1 }).limit(300);

    const interlocutorsMap = new Map();

    for (const msg of recentMessages) {
        const otherId = msg.sender.toString() === uid ? msg.recipient.toString() : msg.sender.toString();
        if (!interlocutorsMap.has(otherId)) {
            interlocutorsMap.set(otherId, {
                messages: [msg],
                lastMessage: msg,
                unreadCount: (msg.recipient.toString() === uid && !msg.isRead) ? 1 : 0
            });
        } else {
            const entry = interlocutorsMap.get(otherId);
            if (entry.messages.length < 20) {
                entry.messages.push(msg);
            }
            if (msg.recipient.toString() === uid && !msg.isRead) {
                entry.unreadCount += 1;
            }
        }
    }

    // 3. Charger les utilisateurs manquants s'ils ne sont pas deja dans friendsMap
    const missingUserIds = Array.from(interlocutorsMap.keys()).filter(id => !friendsMap.has(id));
    if (missingUserIds.length > 0) {
        const missingUsers = await User.find({ _id: { $in: missingUserIds } }).select('login avatar level');
        missingUsers.forEach(u => {
            friendsMap.set(u._id.toString(), {
                _id: u._id,
                login: u.login,
                avatar: u.avatar,
                level: u.level || 1
            });
        });
    }

    // 4. Assembler toutes les conversations
    const conversationList = [];
    friendsMap.forEach((friend, friendId) => {
        const chatData = interlocutorsMap.get(friendId);
        conversationList.push({
            friend,
            recentMessages: chatData ? chatData.messages : [],
            lastMessage: chatData ? chatData.lastMessage : null,
            unreadCount: chatData ? chatData.unreadCount : 0
        });
    });

    return conversationList.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
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