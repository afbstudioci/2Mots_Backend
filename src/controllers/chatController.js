//src/controllers/chatController.js
const chatService = require('../services/chatService');
const cloudinary = require('../config/cloudinary');

exports.getHistory = async (req, res) => {
    try {
        const history = await chatService.getChatHistory(req.user.id, req.params.friendId);
        res.status(200).json({ status: 'success', data: history });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Upload de média pour le chat (Image, Vidéo, Audio)
 */
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'Aucun fichier fourni' });
        }

        const resourceType = req.body.type === 'video' ? 'video' : (req.body.type === 'audio' ? 'video' : 'image');

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: '2mots_chat',
                    resource_type: resourceType,
                    allowed_formats: ['jpg', 'png', 'mp4', 'm4a', 'wav', 'mp3'],
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        res.status(200).json({ 
            status: 'success', 
            data: { 
                fileUrl: uploadResult.secure_url, 
                fileId: uploadResult.public_id,
                duration: uploadResult.duration || null
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Mise à jour du token FCM du joueur
 */
exports.updateFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        const user = await require('../models/User').findById(req.user.id);
        user.fcmToken = token;
        await user.save();
        res.status(200).json({ status: 'success', message: 'Token FCM mis à jour' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
/**
 * Marque les messages comme lus
 */
exports.markAsRead = async (req, res) => {
    try {
        await chatService.markMessagesAsRead(req.user.id, req.params.friendId);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Récupère le nombre total de messages non lus
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await chatService.getGlobalUnreadCount(req.user.id);
        res.status(200).json({ status: 'success', data: { unreadCount: count } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Récupère la liste des conversations (dernier message + compteur)
 */
exports.getConversations = async (req, res) => {
    try {
        const conversations = await chatService.getConversationList(req.user.id);
        res.status(200).json({ status: 'success', data: conversations });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Édite un message
 */
exports.editMessage = async (req, res) => {
    try {
        const { text } = req.body;
        const message = await chatService.editMessage(req.params.messageId, req.user.id, text);
        res.status(200).json({ status: 'success', data: message });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

/**
 * Supprime un message (pour tout le monde)
 */
exports.deleteMessage = async (req, res) => {
    try {
        const message = await chatService.deleteMessage(req.params.messageId, req.user.id);
        res.status(200).json({ status: 'success', data: message });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

/**
 * Gère les réactions
 */
exports.toggleReaction = async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await chatService.toggleReaction(req.params.messageId, req.user.id, emoji);
        res.status(200).json({ status: 'success', data: message });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

/**
 * Efface l'historique de discussion
 */
exports.clearHistory = async (req, res) => {
    try {
        await chatService.clearChatHistory(req.user.id, req.params.friendId);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
