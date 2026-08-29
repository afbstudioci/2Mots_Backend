// src/services/notificationService.js
// MOTEUR DE NOTIFICATIONS HYBRIDE (DB + FCM PUSH V1 + SOCKET.IO)
// STANDARD: Industriel / Bank Grade (Strict <= 270 lignes)

const https = require('https');
const User = require('../models/User');
const Notification = require('../models/Notification');
const admin = require('../config/firebase');

const PUSH_CHANNEL_ID = 'twomots_alerts_v3';
let ioInstance = null;

exports.setIo = (io) => {
    ioInstance = io;
};

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
                console.log('[PUSH_EXPO] Reponse:', resData);
                resolve(true);
            });
        });

        req.on('error', (err) => {
            console.warn('[PUSH_EXPO] Erreur reseau:', err.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
};

exports.sendNotification = async (recipientId, title, body, type = 'general', rawData = {}, senderId = null) => {
    let savedNotification = null;

    // 1. Persistance DB
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

    // 2. Diffusion Temps Reel Socket.io
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
        console.warn('[NOTIF_SOCKET] Erreur emission temps reel:', sockErr.message);
    }

    // 3. Push Mobile FCM v1 / Expo
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
            console.log(`[PUSH] Envoi Expo Push a ${user.login}`);
            await sendExpoPush(token, title, body, sanitizedData);
            return savedNotification;
        }

        const message = {
            notification: {
                title: String(title),
                body: String(body)
            },
            data: {
                title: String(title),
                body: String(body),
                type: String(type),
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                ...sanitizedData
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: PUSH_CHANNEL_ID,
                    sound: 'default',
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
            console.log(`[PUSH] Envoi FCM v1 a ${user.login} (${recipientId}) via canal ${PUSH_CHANNEL_ID}`);
            const response = await admin.messaging().send(message);
            console.log(`[PUSH] Succes FCM ID: ${response}`);
        } else {
            console.warn('[PUSH] Firebase Admin non initialise, tentative Expo fallback');
            await sendExpoPush(token, title, body, sanitizedData);
        }
    } catch (error) {
        console.warn(`[PUSH] Erreur envoi push pour ${recipientId}: [${error.code || 'UNKNOWN'}] ${error.message}`);
        if (error.code === 'messaging/registration-token-not-registered') {
            console.warn(`[PUSH] Token desenregistre pour ${recipientId}, nettoyage en base.`);
            await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        }
    }

    return savedNotification;
};

// Evenements Metiers
exports.onDuelInvite = async (recipientId, challengerName, betAmount, duelId, challengerId = null) => {
    await exports.sendNotification(recipientId, 'Defi en Duel !', `${challengerName} vous defie en Duel pour ${betAmount} Kevs !`, 'duel_invite', {
        challengerName,
        betAmount: String(betAmount),
        duelId: String(duelId)
    }, challengerId);
};

exports.onDuelAccepted = async (challengerId, opponentName, duelId, opponentId = null) => {
    await exports.sendNotification(challengerId, 'Defi accepte !', `${opponentName} a accepte votre defi ! Rejoignez l'arene !`, 'duel_accepted', {
        opponentName,
        duelId: String(duelId)
    }, opponentId);
};

exports.onDuelRejected = async (challengerId, opponentName, opponentId = null) => {
    await exports.sendNotification(challengerId, 'Defi decline', `${opponentName} a refuse votre invitation.`, 'duel_rejected', {
        opponentName
    }, opponentId);
};

exports.onNewMessage = async (recipientId, senderName, messageText, type, senderId = null) => {
    const bodyMap = {
        text: messageText,
        image: 'a envoye une photo',
        video: 'a envoye une video',
        audio: 'a envoye un message vocal'
    };
    await exports.sendNotification(recipientId, senderName, bodyMap[type] || messageText, 'chat_message', {
        senderName
    }, senderId);
};

exports.onFriendRequestSent = async (recipientId, senderName, senderId = null) => {
    await exports.sendNotification(recipientId, "Nouvelle demande d'ami", `${senderName} souhaite devenir votre ami !`, 'friend_request', {
        senderName
    }, senderId);
};

exports.onFriendRequestAccepted = async (requesterId, accepterName, accepterId = null) => {
    await exports.sendNotification(requesterId, 'Demande acceptee !', `${accepterName} et vous etes maintenant amis !`, 'friend_accepted', {
        accepterName
    }, accepterId);
};

exports.onLevelUp = async (userId, newLevel) => {
    await exports.sendNotification(userId, 'Niveau superieur !', `Felicitations ! Vous avez atteint le niveau ${newLevel} !`, 'level_up', {
        level: String(newLevel)
    });
};

exports.onMissionComplete = async (userId, missionTitle) => {
    await exports.sendNotification(userId, 'Mission terminee !', `"${missionTitle}" est prete a etre reclamee !`, 'mission_complete', {
        missionTitle
    });
};
