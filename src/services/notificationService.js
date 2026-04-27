//src/services/notificationService.js
const User = require('../models/User');
const admin = require('../config/firebase');

/**
 * Service centralisé pour l'envoi de notifications push
 * Toutes les notifications de l'app passent par ici
 */

const send = async (recipientId, title, body, data = {}) => {
    try {
        const user = await User.findById(recipientId);
        if (!user || !user.fcmToken) return;

        const payload = {
            notification: {
                title,
                body,
                sound: 'default',
            },
            data: {
                ...data,
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
                    visibility: 'public', // Visible sur l'écran verrouillé
                }
            },
            token: user.fcmToken
        };

        await admin.messaging().send(payload);
        console.log(`[PUSH] Notification envoyée à ${user.login}: "${title}"`);
    } catch (error) {
        // Ne pas crasher si Firebase n'est pas configuré
        if (error.code === 'app/no-app') {
            console.warn('[PUSH] Firebase non initialisé, notification ignorée');
        } else {
            console.error('[PUSH] Erreur:', error.message);
        }
    }
};

// --- NOTIFICATIONS DE CHAT ---

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

// --- NOTIFICATIONS SOCIALES ---

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

// --- NOTIFICATIONS DE JEU ---

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
