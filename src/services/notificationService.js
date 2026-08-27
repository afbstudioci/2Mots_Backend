//src/services/notificationService.js
const https = require('https');
const User = require('../models/User');
const admin = require('../config/firebase');

/**
 * Envoi sécurisé de push notification via Expo Push API
 */
const sendExpoPush = (pushToken, title, body, data) => {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            to: pushToken,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
            channelId: 'default'
        });

        const req = https.request({
            hostname: 'exp.host',
            port: 443,
            path: '/--/api/v2/push/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
            }
        }, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => resolve(true));
        });

        req.on('error', (err) => {
            console.warn('[PUSH_EXPO] Erreur réseau:', err.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
};

/**
 * Service centralisé pour l'envoi de notifications push
 */
const send = async (recipientId, title, body, rawData = {}) => {
    try {
        const user = await User.findById(recipientId).select('fcmToken login').lean();
        if (!user || !user.fcmToken) return;

        const token = user.fcmToken.trim();
        const sanitizedData = {};
        for (const [key, value] of Object.entries(rawData)) {
            sanitizedData[key] = value !== undefined && value !== null ? String(value) : '';
        }

        if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
            await sendExpoPush(token, title, body, sanitizedData);
            return;
        }

        const payload = {
            notification: {
                title,
                body,
            },
            data: {
                ...sanitizedData,
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default',
                    priority: 'max',
                    defaultVibrateTimings: true,
                    defaultSound: true,
                    visibility: 'public',
                }
            },
            token
        };

        if (admin.apps && admin.apps.length > 0) {
            await admin.messaging().send(payload);
        }
    } catch (error) {
        if (error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
            console.warn(`[PUSH] Token expiré pour ${recipientId}, purge en base.`);
            await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        } else if (error.code === 'app/no-app') {
            console.warn('[PUSH] Firebase non initialisé, notification ignorée');
        } else {
            console.warn('[PUSH] Notification non délivrée:', error.message);
        }
    }
};

// Notifications de Duel
exports.onDuelInvite = async (recipientId, challengerName, betAmount, duelId) => {
    await send(recipientId, 'Défi en Duel !', `${challengerName} vous défie en Duel 1v1 pour ${betAmount} Kevs !`, {
        type: 'duel_invite',
        challengerName,
        betAmount: String(betAmount),
        duelId: String(duelId)
    });
};

exports.onDuelAccepted = async (challengerId, opponentName, duelId) => {
    await send(challengerId, 'Défi accepté !', `${opponentName} a accepté votre défi ! Le duel commence !`, {
        type: 'duel_accepted',
        opponentName,
        duelId: String(duelId)
    });
};

exports.onDuelRejected = async (challengerId, opponentName) => {
    await send(challengerId, 'Défi refusé', `${opponentName} a décliné votre invitation de duel.`, {
        type: 'duel_rejected',
        opponentName
    });
};

// Notifications de Chat
exports.onNewMessage = async (recipientId, senderName, messageText, type) => {
    const bodyMap = {
        text: messageText,
        image: 'a envoyé une photo',
        video: 'a envoyé une vidéo',
        audio: 'a envoyé un message vocal'
    };
    await send(recipientId, senderName, bodyMap[type] || messageText, {
        type: 'chat_message',
        senderName
    });
};

// Notifications Sociales
exports.onFriendRequestSent = async (recipientId, senderName) => {
    await send(recipientId, 'Nouvelle demande d\'ami', `${senderName} souhaite devenir votre ami !`, {
        type: 'friend_request',
        senderName
    });
};

exports.onFriendRequestAccepted = async (requesterId, accepterName) => {
    await send(requesterId, 'Demande acceptée !', `${accepterName} et vous êtes maintenant amis !`, {
        type: 'friend_accepted',
        accepterName
    });
};

// Notifications de Progression
exports.onLevelUp = async (userId, newLevel) => {
    await send(userId, 'Niveau supérieur !', `Félicitations ! Vous avez atteint le niveau ${newLevel} !`, {
        type: 'level_up',
        level: String(newLevel)
    });
};

exports.onMissionComplete = async (userId, missionTitle) => {
    await send(userId, 'Mission terminée !', `"${missionTitle}" est prête à être réclamée !`, {
        type: 'mission_complete',
        missionTitle
    });
};
