// src/services/presenceService.js
// SERVICE DE GESTION DE PRESENCE TEMPS REEL (SOCKET.IO) - 2MOTS
// Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const userSockets = new Map(); // userId -> Set of socketIds
const socketUser = new Map();  // socketId -> userId

let ioInstance = null;

exports.setIo = (io) => {
    ioInstance = io;
};

exports.addUserSocket = (userId, socketId) => {
    if (!userId || !socketId) return;
    const strUserId = String(userId);

    if (!userSockets.has(strUserId)) {
        userSockets.set(strUserId, new Set());
    }

    const set = userSockets.get(strUserId);
    const wasOffline = set.size === 0;
    set.add(socketId);
    socketUser.set(socketId, strUserId);

    // Si l'utilisateur vient de passer en ligne, on diffuse l'evenement
    if (wasOffline && ioInstance) {
        ioInstance.emit('user_presence_change', {
            userId: strUserId,
            isOnline: true
        });
    }
};

exports.removeUserSocket = (socketId) => {
    if (!socketId || !socketUser.has(socketId)) return;
    const strUserId = socketUser.get(socketId);
    socketUser.delete(socketId);

    if (userSockets.has(strUserId)) {
        const set = userSockets.get(strUserId);
        set.delete(socketId);

        if (set.size === 0) {
            userSockets.delete(strUserId);
            // Utilisateur completement deconnecte
            if (ioInstance) {
                ioInstance.emit('user_presence_change', {
                    userId: strUserId,
                    isOnline: false
                });
            }
        }
    }
};

exports.isUserOnline = (userId) => {
    if (!userId) return false;
    const strUserId = String(userId);
    return userSockets.has(strUserId) && userSockets.get(strUserId).size > 0;
};

exports.getOnlineUserIds = () => {
    return Array.from(userSockets.keys());
};
