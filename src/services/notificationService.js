//src/services/notificationService.js
const https = require('https');
const User = require('../models/User');
const Notification = require('../models/Notification');
const admin = require('../config/firebase');

const PUSH_CHANNEL_ID = 'default';
let ioInstance = null;

/**
 * Injection de l'instance Socket.io pour diffusion temps réel
 */
exports.setIo = (io) => {
    ioInstance = io;
};

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
 * Moteur Hybride Bank-Grade (Standard Yély) :
 * 1. Persistance DB (Notification.create avec TTL 30j)
 * 2. Push Système FCM v1 / Expo
 * 3. Diffusion Temps Réel In-App (Socket.io)
 */
exports.sendNotification = async (recipientId, title, body, type = 'general', rawData = {}, senderId = null) => {
    let savedNotification = null;

    // ÉTAPE 1 : Persistance DB
    try {
        savedNotification = await Notification.create({
            recipient: recipientId,
            sender: senderId,
            title,
            body,
            type,
            data: rawData
        });
    } catch (dbErr) {
        console.warn('[NOTIF_DB] Erreur persistance notification:', dbErr.message);
    }

    // ÉTAPE 2 : Diffusion Temps Réel Socket.io
    try {
        if (ioInstance) {
            ioInstance.to(String(recipientId)).emit('notification_received', savedNotification || {
                recipient: recipientId,
                title,
                body,
                type,
                data: rawData,
                createdAt: new Date()
            });
        }
    } catch (sockErr) {
        console.warn('[NOTIF_SOCKET] Erreur émission temps réel:', sockErr.message);
    }

    // ÉTAPE 3 : Push Notification Mobile (FCM v1 / Expo)
    try {
        const user = await User.findById(recipientId).select('+fcmToken login').lean();
        if (!user || !user.fcmToken) {
            console.log(`[PUSH] Destinataire ${recipientId} sans fcmToken.`);
            return savedNotification;
        }

        const token = String(user.fcmToken).trim();
        if (!token) return savedNotification;

        const sanitizedData = {};
        for (const [key, value] of Object.entries(rawData)) {
            sanitizedData[key] = value !== undefined && value !== null ? String(value) : '';
        }

        if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
            console.log(`[PUSH] Envoi Expo Push à ${user.login}`);
            await sendExpoPush(token, title, body, sanitizedData);
            return savedNotification;
        }

        const message = {
            notification: { title, body },
            data: {
                title: String(title),
                body: String(body),
                type: String(type),
                ...sanitizedData
            },
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
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn(`[PUSH] Token désenregistré pour ${recipientId}, nettoyage en base.`);
            await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        }
    }

    return savedNotification;
};

// --- Notifications Événements Duel ---

exports.onDuelInvite = async (recipientId, challengerName, betAmount, duelId, challengerId = null) => {
    await exports.sendNotification(recipientId, 'Défi en Duel !', `${challengerName} vous défie en Duel pour ${betAmount} Kevs !`, 'duel_invite', {
        challengerName,
        betAmount: String(betAmount),
        duelId: String(duelId)
    }, challengerId);
};

exports.onDuelAccepted = async (challengerId, opponentName, duelId, opponentId = null) => {
    await exports.sendNotification(challengerId, 'Défi accepté !', `${opponentName} a accepté votre défi ! Rejoignez l'arène !`, 'duel_accepted', {
        opponentName,
        duelId: String(duelId)
    }, opponentId);
};

exports.onDuelRejected = async (challengerId, opponentName, opponentId = null) => {
    await exports.sendNotification(challengerId, 'Défi décliné', `${opponentName} a refusé votre invitation.`, 'duel_rejected', {
        opponentName
    }, opponentId);
};

// --- Notifications Sociales et Messages ---

exports.onNewMessage = async (recipientId, senderName, messageText, type, senderId = null) => {
    const bodyMap = {
        text: messageText,
        image: 'a envoyé une photo',
        video: 'a envoyé une vidéo',
        audio: 'a envoyé un message vocal'
    };
    await exports.sendNotification(recipientId, senderName, bodyMap[type] || messageText, 'chat_message', {
        senderName
    }, senderId);
};

exports.onFriendRequestSent = async (recipientId, senderName, senderId = null) => {
    await exports.sendNotification(recipientId, 'Nouvelle demande d\'ami', `${senderName} souhaite devenir votre ami !`, 'friend_request', {
        senderName
    }, senderId);
};

exports.onFriendRequestAccepted = async (requesterId, accepterName, accepterId = null) => {
    await exports.sendNotification(requesterId, 'Demande acceptée !', `${accepterName} et vous êtes maintenant amis !`, 'friend_accepted', {
        accepterName
    }, accepterId);
};

exports.onLevelUp = async (userId, newLevel) => {
    await exports.sendNotification(userId, 'Niveau supérieur !', `Félicitations ! Vous avez atteint le niveau ${newLevel} !`, 'level_up', {
        level: String(newLevel)
    });
};

exports.onMissionComplete = async (userId, missionTitle) => {
    await exports.sendNotification(userId, 'Mission terminée !', `"${missionTitle}" est prête à être réclamée !`, 'mission_complete', {
        missionTitle
    });
};
