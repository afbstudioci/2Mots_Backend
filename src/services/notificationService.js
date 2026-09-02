// src/services/notificationService.js
// MOTEUR DE NOTIFICATIONS HYBRIDE (DB + FCM v1 DIRECT + SOCKET.IO)
// Architecture : FCM direct via Firebase Admin SDK (sans relay Expo)

const User = require('../models/User');
const Notification = require('../models/Notification');
const admin = require('../config/firebase');

const PUSH_CHANNEL_ID = 'twomots_channel_v4_urgent';
let ioInstance = null;

exports.setIo = (io) => {
    ioInstance = io;
};

// Verification que Firebase est actif, avec log clair
const isFcmReady = () => {
    const ready = admin.apps && admin.apps.length > 0;
    if (!ready) {
        console.error('[PUSH] CRITIQUE : Firebase Admin non initialise ! Les push FCM seront impossibles.');
        console.error('[PUSH] Verifiez FIREBASE_SERVICE_ACCOUNT ou les 3 variables individuelles sur Render.');
    }
    return ready;
};

// Sanitisation des data FCM : FCM v1 exige des valeurs string uniquement
const sanitizeDataPayload = (rawData = {}) => {
    const out = {};
    for (const [key, value] of Object.entries(rawData)) {
        out[key] = value !== undefined && value !== null ? String(value) : '';
    }
    return out;
};

// Construction du payload FCM v1 valide
// Canal haute priorité : 'twomots_channel_v4_urgent'
// Priorité de transport : 'high' | Priorité d'affichage Android : 'PRIORITY_MAX' | Visibilité : 'PUBLIC'
const buildFcmMessage = (token, title, body, type, sanitizedData) => ({
    notification: {
        title: String(title),
        body: String(body),
    },
    data: {
        title: String(title),
        body: String(body),
        type: String(type),
        ...sanitizedData,
    },
    android: {
        priority: 'high',
        notification: {
            channelId: PUSH_CHANNEL_ID,
            sound: 'default',
            color: '#FF7F50',
            priority: 'PRIORITY_MAX',
            visibility: 'PUBLIC',
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationCount: 1,
        },
    },
    apns: {
        payload: {
            aps: {
                sound: 'default',
                badge: 1,
                contentAvailable: true,
            },
        },
    },
    token,
});

exports.sendNotification = async (recipientId, title, body, type = 'general', rawData = {}, senderId = null) => {
    let savedNotification = null;

    // 1. Persistance DB (non bloquant)
    try {
        savedNotification = await Notification.create({
            recipient: recipientId,
            sender: senderId,
            title,
            body,
            type,
            data: rawData,
        });
    } catch (dbErr) {
        console.warn('[NOTIF_DB] Erreur persistance:', dbErr.message);
    }

    // 2. Diffusion Temps Reel Socket.io (si connecte)
    try {
        if (ioInstance) {
            ioInstance.to(String(recipientId)).emit('notification_received', savedNotification || {
                recipient: recipientId,
                title,
                body,
                type,
                data: rawData,
                createdAt: new Date(),
            });
        }
    } catch (sockErr) {
        console.warn('[NOTIF_SOCKET] Erreur emission:', sockErr.message);
    }

    // 3. Push Mobile FCM v1 Direct (Firebase Admin SDK uniquement)
    try {
        const user = await User.findById(recipientId).select('+fcmToken login').lean();

        if (!user) {
            console.warn(`[PUSH] Utilisateur ${recipientId} introuvable en base.`);
            return savedNotification;
        }

        if (!user.fcmToken) {
            console.warn(`[PUSH] Utilisateur "${user.login}" (${recipientId}) : fcmToken absent en base. Push impossible.`);
            console.warn('[PUSH] Verifiez que le client appelle POST /api/auth/fcm-token apres login.');
            return savedNotification;
        }

        const token = String(user.fcmToken).trim();

        // GUARD : token au format Expo ? C'est une erreur de configuration frontend
        if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
            console.error(`[PUSH] ERREUR CONFIGURATION : L'utilisateur "${user.login}" a enregistre un token Expo (${token.substring(0, 40)}...).`);
            console.error('[PUSH] Le frontend doit appeler Notifications.getDevicePushTokenAsync() et NON getExpoPushTokenAsync().');
            return savedNotification;
        }

        if (!isFcmReady()) {
            return savedNotification;
        }

        const sanitizedData = sanitizeDataPayload(rawData);
        const message = buildFcmMessage(token, title, body, type, sanitizedData);

        console.log(`[PUSH] Envoi FCM v1 a "${user.login}" (canal: ${PUSH_CHANNEL_ID})`);
        const fcmResponse = await admin.messaging().send(message);
        console.log(`[PUSH] Succes FCM - Message ID: ${fcmResponse}`);

    } catch (error) {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn(`[PUSH] Token expire/invalide pour ${recipientId} — nettoyage en base.`);
            await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        } else {
            console.error(`[PUSH] Echec envoi push pour ${recipientId}: [${error.code || 'UNKNOWN'}] ${error.message}`);
        }
    }

    return savedNotification;
};

// --- Evenements Metiers ---

exports.onDuelInvite = async (recipientId, challengerName, betAmount, duelId, challengerId = null) => {
    await exports.sendNotification(
        recipientId,
        'Defi en Duel !',
        `${challengerName} vous defie pour ${betAmount} Kevs !`,
        'duel_invite',
        { challengerName, betAmount: String(betAmount), duelId: String(duelId) },
        challengerId
    );
};

exports.onDuelAccepted = async (challengerId, opponentName, duelId, opponentId = null) => {
    await exports.sendNotification(
        challengerId,
        'Defi accepte !',
        `${opponentName} a accepte votre defi ! Rejoignez l'arene !`,
        'duel_accepted',
        { opponentName, duelId: String(duelId) },
        opponentId
    );
};

exports.onDuelRejected = async (challengerId, opponentName, opponentId = null) => {
    await exports.sendNotification(
        challengerId,
        'Defi decline',
        `${opponentName} a refuse votre invitation.`,
        'duel_rejected',
        { opponentName },
        opponentId
    );
};

exports.onNewMessage = async (recipientId, senderName, messageText, type, senderId = null) => {
    const bodyMap = {
        text: messageText,
        image: 'a envoyé une photo',
        video: 'a envoyé une vidéo',
        audio: 'a envoyé un message vocal',
    };
    await exports.sendNotification(
        recipientId,
        senderName,
        bodyMap[type] || messageText || 'Nouveau message',
        'chat_message',
        {
            senderName,
            friendId: senderId ? String(senderId) : '',
            friendName: senderName,
        },
        senderId
    );
};

exports.onFriendRequestSent = async (recipientId, senderName, senderId = null) => {
    await exports.sendNotification(
        recipientId,
        "Nouvelle demande d'ami",
        `${senderName} souhaite devenir votre ami !`,
        'friend_request',
        { senderName, senderId: senderId ? String(senderId) : '' },
        senderId
    );
};

exports.onFriendRequestAccepted = async (requesterId, accepterName, accepterId = null) => {
    await exports.sendNotification(
        requesterId,
        'Demande acceptée !',
        `${accepterName} et vous êtes maintenant amis !`,
        'friend_accepted',
        { accepterName, accepterId: accepterId ? String(accepterId) : '' },
        accepterId
    );
};

exports.onLevelUp = async (userId, newLevel) => {
    await exports.sendNotification(
        userId,
        'Niveau superieur !',
        `Felicitations ! Vous avez atteint le niveau ${newLevel} !`,
        'level_up',
        { level: String(newLevel) }
    );
};

exports.onMissionComplete = async (userId, missionTitle) => {
    await exports.sendNotification(
        userId,
        'Mission terminee !',
        `"${missionTitle}" est prete a etre reclamee !`,
        'mission_complete',
        { missionTitle }
    );
};
