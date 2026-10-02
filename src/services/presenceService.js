// src/services/presenceService.js
// SERVICE DE GESTION DE PRESENCE ET DIFFUSION TEMPS REEL (SOCKET.IO) - 2MOTS
// Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const userSockets = new Map(); // userId -> Set of socketIds
const socketUser = new Map();  // socketId -> userId

let ioInstance = null;

exports.setIo = (io) => {
    ioInstance = io;
};

exports.getIo = () => ioInstance;

exports.emitToUser = (userId, event, data) => {
    if (!userId || !ioInstance) return;
    ioInstance.to(String(userId)).emit(event, data);
};

exports.emitBalanceUpdate = (userId, userDoc) => {
    if (!userId || !ioInstance || !userDoc) return;
    ioInstance.to(String(userId)).emit('user_balance_updated', {
        kevs: userDoc.kevs ?? 0,
        streakFreezes: userDoc.streakFreezes ?? 0,
        inventory: userDoc.inventory,
        level: userDoc.level ?? 1,
        xp: userDoc.xp ?? 0,
        kevyKeys: userDoc.kevyKeys ?? 0,
        isVip: Boolean(userDoc.isVip),
    });
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
