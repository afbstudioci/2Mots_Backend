// src/services/expoPushService.js
// SERVICE D'ENVOI DES NOTIFICATIONS PUSH EXPO (ANDROID HAUTE PRIORITE)
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

/**
 * Verifie si un token est un token push Expo valide
 * @param {string} token
 * @returns {boolean}
 */
const isValidExpoToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  return Expo.isExpoPushToken(token.trim());
};

/**
 * Envoie une notification push Android a une liste d'utilisateurs.
 * @param {object} params
 * @param {Array<string>} params.userIds - Liste des IDs Mongo des destinataires.
 * @param {string} params.title - Titre affiche sur le telephone.
 * @param {string} params.body - Corps du message.
 * @param {object} [params.data] - Donnees utiles pour la navigation in-app (duelId, type, etc.).
 */
async function sendAndroidPushNotification({ userIds, title, body, data = {} }) {
  try {
    if (!userIds || !userIds.length) return;
    const users = await User.find({ _id: { $in: userIds } }).select('pushTokens fcmToken login').lean();
    const messages = [];

    const sanitizedData = {};
    for (const [k, v] of Object.entries(data || {})) {
      sanitizedData[k] = v !== undefined && v !== null ? String(v) : '';
    }
    sanitizedData.title = String(title);
    sanitizedData.body = String(body);

    for (const user of users) {
      const tokens = [];
      if (user.pushTokens && Array.isArray(user.pushTokens)) {
        for (const t of user.pushTokens) {
          if (t?.token && isValidExpoToken(t.token)) {
            tokens.push(t.token.trim());
          }
        }
      }
      if (user.fcmToken && isValidExpoToken(user.fcmToken) && !tokens.includes(user.fcmToken.trim())) {
        tokens.push(user.fcmToken.trim());
      }

      for (const token of tokens) {
        messages.push({
          to: token,
          sound: 'default',
          title: String(title),
          body: String(body),
          data: sanitizedData,
          channelId: 'default', // DOIT CORRESPONDRE au canal cree cote client
          priority: 'high',     // Reveille le telephone en arriere-plan
          ttl: 60 * 60 * 24,    // Conserve le message 24h si le smartphone est eteint
          _displayInForeground: true,
        });
      }
    }

    if (!messages.length) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        ticketChunk.forEach(async (ticket, index) => {
          if (ticket.status === 'error') {
            console.error('[EXPO_PUSH] Erreur ticket Expo:', ticket.message);
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const obsoleteToken = chunk[index].to;
              await User.updateMany(
                { 'pushTokens.token': obsoleteToken },
                { $pull: { pushTokens: { token: obsoleteToken } } }
              );
              console.log(`[EXPO_PUSH] Token obsolete retire de la base : ${obsoleteToken}`);
            }
          }
        });
      } catch (chunkError) {
        console.error('[EXPO_PUSH] Erreur chunk:', chunkError);
      }
    }
  } catch (error) {
    console.error('[EXPO_PUSH] Erreur globale:', error);
  }
}

/**
 * Envoie une notification push a un utilisateur unique
 */
const sendPushToUser = async (recipientId, title, body, type = 'general', rawData = {}, notificationId = null) => {
  return sendAndroidPushNotification({
    userIds: [recipientId],
    title,
    body,
    data: { ...rawData, type, notificationId: notificationId ? String(notificationId) : '' },
  });
};

module.exports = {
  isValidExpoToken,
  sendAndroidPushNotification,
  sendPushToUser,
};
