// src/services/expoPushService.js
// SERVICE D'ENVOI DES NOTIFICATIONS PUSH EXPO (100% GRATUIT)
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
 * Envoie une notification push a un utilisateur cible via Expo Push
 * @param {string} recipientId - ID MongoDB du destinataire
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps du texte
 * @param {string} type - Type d'evenement metier (duel_invite, duel_accepted, etc.)
 * @param {object} rawData - Donnees additionnelles transmises
 * @param {string} [notificationId] - ID de la notification persistee en base
 * @returns {Promise<boolean>}
 */
const sendPushToUser = async (recipientId, title, body, type = 'general', rawData = {}, notificationId = null) => {
  try {
    const user = await User.findById(recipientId).select('+fcmToken login').lean();
    if (!user) {
      console.warn(`[EXPO_PUSH] Utilisateur ${recipientId} introuvable en base.`);
      return false;
    }

    const token = user.fcmToken ? String(user.fcmToken).trim() : null;
    if (!token) {
      console.log(`[EXPO_PUSH] Utilisateur "${user.login}" sans token push actif.`);
      return false;
    }

    if (!isValidExpoToken(token)) {
      console.warn(`[EXPO_PUSH] Token invalide pour "${user.login}": ${token.substring(0, 15)}...`);
      return false;
    }

    // Nettoyage et formatage strict des donnees
    const sanitizedData = {};
    for (const [k, v] of Object.entries(rawData || {})) {
      sanitizedData[k] = v !== undefined && v !== null ? String(v) : '';
    }
    sanitizedData.title = String(title);
    sanitizedData.body = String(body);
    sanitizedData.type = String(type);
    if (notificationId) sanitizedData.notificationId = String(notificationId);

    const message = {
      to: token,
      sound: 'default',
      title: String(title),
      body: String(body),
      data: sanitizedData,
      priority: 'high',
      channelId: 'default',
      badge: 1,
      _displayInForeground: true,
    };

    console.log(`[EXPO_PUSH] Envoi push a "${user.login}" (${type})`);
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (chunkError) {
        console.error('[EXPO_PUSH] Erreur lors de l\'envoi du chunk:', chunkError.message);
      }
    }

    // Traitement des tickets de retour
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error(`[EXPO_PUSH] Erreur ticket Expo: [${ticket.details?.error}] ${ticket.message}`);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.warn(`[EXPO_PUSH] Token perime pour ${recipientId} - suppression en base.`);
          await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
        }
      } else {
        console.log(`[EXPO_PUSH] Succes envoi - Ticket ID: ${ticket.id}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`[EXPO_PUSH] Echec envoi push pour ${recipientId}:`, error.message);
    return false;
  }
};

module.exports = {
  isValidExpoToken,
  sendPushToUser,
};
