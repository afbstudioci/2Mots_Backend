//src/index.js
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const chatService = require('./services/chatService');

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const notificationService = require('./services/notificationService');
notificationService.setIo(io);

const presenceService = require('./services/presenceService');
presenceService.setIo(io);

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`[SOCKET] Nouvel utilisateur connecté: ${socket.id}`);

    socket.on('join', (userId) => {
        if (!userId) return;
        socket.join(String(userId));
        presenceService.addUserSocket(userId, socket.id);
        console.log(`[SOCKET] Utilisateur ${userId} a rejoint sa room privée et est EN LIGNE`);
    });

    socket.on('get_online_users', (callback) => {
        if (typeof callback === 'function') {
            callback(presenceService.getOnlineUserIds());
        }
    });

    socket.on('typing_start', ({ recipientId, senderId }) => {
        io.to(recipientId).emit('typing_start', { senderId });
    });

    socket.on('typing_stop', ({ recipientId, senderId }) => {
        io.to(recipientId).emit('typing_stop', { senderId });
    });

    socket.on('send_message', async (data) => {
        const { senderId, recipientId, text, type, fileUrl, fileId, duration, senderName, replyTo } = data;

        try {
            const savedMessage = await chatService.saveMessage(senderId, recipientId, {
                text, type, fileUrl, fileId, duration, replyTo
            });

            io.to(recipientId).emit('receive_message', savedMessage);
            socket.emit('message_sent', savedMessage);

            const settings = await chatService.getChatSettings(recipientId, senderId);
            if (!settings.muteNotifications) {
                chatService.sendPushNotification(recipientId, senderName, text, type || 'text', senderId);
            }
        } catch (error) {
            console.error("[SOCKET] Erreur envoi message:", error.message);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('edit_message', async ({ messageId, recipientId, text, userId }) => {
        try {
            const updatedMessage = await chatService.editMessage(messageId, userId, text);
            io.to(recipientId).emit('message_edited', updatedMessage);
            socket.emit('message_edited', updatedMessage);
        } catch (error) {
            console.error("[SOCKET] Erreur edit message:", error.message);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('delete_message', async ({ messageId, recipientId, userId }) => {
        try {
            const deletedMessage = await chatService.deleteMessage(messageId, userId);
            io.to(recipientId).emit('message_deleted', { messageId, text: deletedMessage.text });
            socket.emit('message_deleted', { messageId, text: deletedMessage.text });
        } catch (error) {
            console.error("[SOCKET] Erreur delete message:", error.message);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('toggle_reaction', async ({ messageId, recipientId, emoji, userId }) => {
        try {
            const updatedMessage = await chatService.toggleReaction(messageId, userId, emoji);
            io.to(recipientId).emit('reaction_updated', { messageId, reactions: updatedMessage.reactions });
            socket.emit('reaction_updated', { messageId, reactions: updatedMessage.reactions });
        } catch (error) {
            console.error("[SOCKET] Erreur reaction:", error.message);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('message_read', async ({ friendId, userId }) => {
        try {
            await chatService.markMessagesAsRead(userId, friendId);
            io.to(friendId).emit('messages_marked_read', { readerId: userId });
        } catch (error) {
            console.error("[SOCKET] Erreur mark read:", error.message);
        }
    });

    socket.on('disconnect', () => {
        presenceService.removeUserSocket(socket.id);
        console.log(`[SOCKET] Utilisateur déconnecté: ${socket.id}`);
    });

    // Gestion des événements de Duel 1v1
    const registerDuelSocket = require('./sockets/duelSocket');
    registerDuelSocket(io, socket);
});

const vaultService = require('./services/vaultService');

connectDB().then(() => {
    server.listen(port, () => {
        console.log(`[SERVEUR] Démarré sur le port ${port} avec Socket.io prêt`);
        vaultService.preloadAllTiers();
    });
}).catch(err => {
    console.error('[SERVEUR] Échec critique au démarrage :', err);
    process.exit(1);
});