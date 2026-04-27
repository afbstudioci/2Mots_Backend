//src/index.js
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const initAiWorker = require('./workers/aiWordGenerator');
const chatService = require('./services/chatService');

// Création du serveur HTTP
const server = http.createServer(app);

// Initialisation de Socket.io avec CORS
const io = new Server(server, {
    cors: {
        origin: "*", // À affiner en production
        methods: ["GET", "POST"]
    }
});

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
    console.log(`[SOCKET] Nouvel utilisateur connecté: ${socket.id}`);

    // Rejoindre une room privée pour l'utilisateur
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`[SOCKET] Utilisateur ${userId} a rejoint sa room privée`);
    });

    // Envoi de message en temps réel
    socket.on('send_message', async (data) => {
        const { senderId, recipientId, text, type, fileUrl, fileId, duration, senderName } = data;
        
        try {
            // 1. Sauvegarder en DB via le service
            const savedMessage = await chatService.saveMessage(senderId, recipientId, {
                text, type, fileUrl, fileId, duration
            });

            // 2. Envoyer au destinataire en temps réel s'il est connecté
            io.to(recipientId).emit('receive_message', savedMessage);

            // 3. Envoyer une notification Push au destinataire
            chatService.sendPushNotification(recipientId, senderName, text, type || 'text');
            
        } catch (error) {
            console.error("[SOCKET] Erreur envoi message:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET] Utilisateur déconnecté: ${socket.id}`);
    });
});

connectDB().then(() => {
    server.listen(port, () => {
        console.log(`[SERVEUR] Démarré sur le port ${port} avec Socket.io prêt`);
        
        // Initialisation du Générateur IA Autonome une fois la DB prête
        initAiWorker();
    });
}).catch(err => {
    console.error('[SERVEUR] Échec critique au démarrage :', err);
    process.exit(1);
});