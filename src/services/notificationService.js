//src/services/notificationService.js
const https = require('https');
const User = require('../models/User');
const admin = require('../config/firebase');

const PUSH_CHANNEL_ID = 'default';

/**
 * Envoi de secours via Expo Push API
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
            channelId: PUSH_CHANNEL_ID,
            _displayInForeground: true
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
            res.on('end', () => {
                console.log('[PUSH_EXPO] Réponse:', resData);
                resolve(true);
            });
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
 * Service centralisé d'envoi de notifications push résilient (Standard Yély)
 */
const send = async (recipientId, title, body, rawData = {}) => {
    try {
        const user = await User.findById(recipientId).select('fcmToken login').lean();
        if (!user || !user.fcmToken) {
            console.log(`[PUSH] Destinataire ${recipientId} sans fcmToken.`);
            return;
        }

        const token = String(user.fcmToken).trim();
        if (!token) return;

        const sanitizedData = {};
        for (const [key, value] of Object.entries(rawData)) {
            sanitizedData[key] = value !== undefined && value !== null ? String(value) : '';
        }

        // Support Fallback Expo Push Tokens
        if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
            console.log(`[PUSH] Envoi Expo Push à ${user.login}`);
            await sendExpoPush(token, title, body, sanitizedData);
            return;
        }

        // Payload Standard FCM v1 (Multiplateforme)
        const message = {
            notification: {
                title,
                body
            },
            data: sanitizedData,
            android: {
                priority: 'high',
                notification: {
                    title,
                    body,
                    channelId: PUSH_CHANNEL_ID,
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    visibility: 'public',
                    color: '#FF7F50'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true
                    }
                }
            },
            token
        };

        if (admin.apps && admin.apps.length > 0) {
            console.log(`[PUSH] Envoi FCM v1 à ${user.login} (${recipientId})`);
            const response = await admin.messaging().send(message);
            console.log(`[PUSH] Succès FCM ID: ${response}`);
        } else {
            console.warn('[PUSH] Firebase Admin non initialisé, tentative Expo fallback');
            await sendExpoPush(token, title, body, sanitizedData);
        }
    } catch (error) {
        console.warn(`[PUSH] Erreur envoi push pour ${recipientId}: [${error.code || 'UNKNOWN'}] ${error.message}`);
        
        // On ne purge le token QUE si Firebase confirme que le token est définitivement désenregistré
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn(`[PUSH] Token désenregistré pour ${recipientId}, nettoyage en base.`);
            await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        } else if (error.code === 'messaging/mismatched-credential') {
            console.error('[PUSH] ERREUR CRITIQUE: Le Service Account Firebase (Render) ne correspond pas au projet de l\'application !');
        }
    }
};

// --- Notifications Événements Duel ---

exports.onDuelInvite = async (recipientId, challengerName, betAmount, duelId) => {
    await send(recipientId, 'Défi en Duel !', `${challengerName} vous défie en Duel pour ${betAmount} Kevs !`, {
        type: 'duel_invite',
        challengerName,
        betAmount: String(betAmount),
        duelId: String(duelId)
    });
};

exports.onDuelAccepted = async (challengerId, opponentName, duelId) => {
    await send(challengerId, 'Défi accepté !', `${opponentName} a accepté votre défi ! Rejoignez l'arène de jeu !`, {
        type: 'duel_accepted',
        opponentName,
        duelId: String(duelId)
    });
};

exports.onDuelRejected = async (challengerId, opponentName) => {
    await send(challengerId, 'Défi décliné', `${opponentName} a refusé votre invitation.`, {
        type: 'duel_rejected',
        opponentName
    });
};

// --- Notifications Sociales et Messages ---

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
