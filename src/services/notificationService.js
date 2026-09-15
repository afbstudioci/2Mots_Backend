// src/services/notificationService.js
// SERVICE DE GESTION DES NOTIFICATIONS PUSH & TEMPS REEL - 2MOTS
// Standard de developpement : Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const Notification = require('../models/Notification');
const expoPushService = require('./expoPushService');

let ioInstance = null;

exports.setIo = (io) => {
  ioInstance = io;
};

/**
 * Envoie une notification : Persistance DB + Socket.io en direct + Push Mobile Expo
 * @param {string} recipientId
 * @param {string} title
 * @param {string} body
 * @param {string} type
 * @param {object} rawData
 * @param {string|null} senderId
 */
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
      data: rawData,
    });
  } catch (dbErr) {
    console.warn('[NOTIF_DB] Erreur persistance:', dbErr.message);
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
        createdAt: new Date(),
      });
    }
  } catch (sockErr) {
    console.warn('[NOTIF_SOCKET] Erreur emission:', sockErr.message);
  }

  // 3. Envoi Push Mobile via Expo (Arriere-plan & App fermee)
  try {
    await expoPushService.sendPushToUser(
      recipientId,
      title,
      body,
      type,
      rawData,
      savedNotification?._id
    );
  } catch (pushErr) {
    console.warn('[NOTIF_PUSH] Erreur envoi push:', pushErr.message);
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

const duelNotifDedupe = new Map();

exports.onDuelAccepted = async (challengerId, opponentName, duelId, opponentId = null) => {
  const dedupeKey = `duel_accepted_${challengerId}_${duelId}`;
  const now = Date.now();
  if (duelNotifDedupe.has(dedupeKey) && now - duelNotifDedupe.get(dedupeKey) < 30000) {
    console.log(`[NOTIF] Notification duel_accepted déjà envoyée pour le duel ${duelId} (Dédoublonnage actif)`);
    return;
  }
  duelNotifDedupe.set(dedupeKey, now);

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
    image: 'a envoye une photo',
    video: 'a envoye une video',
    audio: 'a envoye un message vocal',
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
    'Demande acceptee !',
    `${accepterName} et vous etes maintenant amis !`,
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
