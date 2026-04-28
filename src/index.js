//src/index.js
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const initAiWorker = require('./workers/aiWordGenerator');
const chatService = require('./services/chatService');

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[SOCKET] Nouvel utilisateur connecté: ${socket.id}`);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`[SOCKET] Utilisateur ${userId} a rejoint sa room privée`);
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
                chatService.sendPushNotification(recipientId, senderName, text, type || 'text');
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
        console.log(`[SOCKET] Utilisateur déconnecté: ${socket.id}`);
    });
});

connectDB().then(() => {
    server.listen(port, () => {
        console.log(`[SERVEUR] Démarré sur le port ${port} avec Socket.io prêt`);
        initAiWorker();
    });
}).catch(err => {
    console.error('[SERVEUR] Échec critique au démarrage :', err);
    process.exit(1);
});