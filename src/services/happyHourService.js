// src/services/happyHourService.js
// SERVICE DE GESTION DE L'HEURE MAGIQUE (HAPPY HOUR DOUBLE KEVS & XP)
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const User = require('../models/User');
const expoPushService = require('./expoPushService');

let manualActiveUntil = null;
let ioInstance = null;

exports.setIo = (io) => {
  ioInstance = io;
};

/**
 * Verifie si le creneau horaire automatique est actuellement actif
 * (Samedi et Dimanche de 19h00 a 21h00 UTC)
 */
const isScheduledHappyHour = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Dimanche, 6 = Samedi
  const hour = now.getUTCHours();
  return (day === 0 || day === 6) && hour >= 19 && hour < 21;
};

/**
 * Indique si l'Heure Magique est actuellement active
 * @returns {boolean}
 */
exports.isHappyHourActive = () => {
  if (manualActiveUntil && Date.now() < manualActiveUntil) {
    return true;
  }
  return isScheduledHappyHour();
};

/**
 * Retourne le multiplicateur de gains (2 si actif, 1 sinon)
 * @returns {number}
 */
exports.getHappyHourMultiplier = () => {
  return exports.isHappyHourActive() ? 2 : 1;
};

/**
 * Retourne le statut detaille de l'Heure Magique pour le client
 */
exports.getHappyHourStatus = () => {
  const isActive = exports.isHappyHourActive();
  let endsAt = null;

  if (manualActiveUntil && Date.now() < manualActiveUntil) {
    endsAt = new Date(manualActiveUntil).toISOString();
  } else if (isScheduledHappyHour()) {
    const end = new Date();
    end.setUTCHours(21, 0, 0, 0);
    endsAt = end.toISOString();
  }

  return {
    isActive,
    multiplier: exports.getHappyHourMultiplier(),
    endsAt,
  };
};

/**
 * Declenche manuellement ou automatiquement l'Heure Magique avec Push Broadcast
 * @param {number} durationMinutes
 */
exports.startHappyHour = async (durationMinutes = 120) => {
  manualActiveUntil = Date.now() + durationMinutes * 60 * 1000;
  console.log(`[HAPPY_HOUR] Heure Magique demarree pour ${durationMinutes} minutes.`);

  // 1. Diffusion Socket.io en direct a tous les joueurs connectes
  if (ioInstance) {
    ioInstance.emit('happy_hour_started', {
      multiplier: 2,
      endsAt: new Date(manualActiveUntil).toISOString(),
    });
  }

  // 2. Diffusion Push Haute Priorite a tous les utilisateurs enregistres
  try {
    const users = await User.find({
      isBanned: false,
      $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
    })
      .select('_id')
      .limit(5000)
      .lean();

    const userIds = users.map((u) => String(u._id));
    if (userIds.length > 0) {
      await expoPushService.sendAndroidPushNotification({
        userIds,
        title: "L'Heure Magique est lancee !",
        body: 'Tous vos gains de Kevs et XP sont DOUBLES pendant 2 heures ! Venez jouer des maintenant.',
        data: { type: 'happy_hour', screen: 'Home', multiplier: '2' },
      });
      console.log(`[HAPPY_HOUR] Push diffuse a ${userIds.length} joueurs.`);
    }
  } catch (error) {
    console.error('[HAPPY_HOUR] Erreur diffusion push:', error.message);
  }
};

/**
 * Cloture l'Heure Magique
 */
exports.endHappyHour = () => {
  manualActiveUntil = null;
  console.log('[HAPPY_HOUR] Heure Magique terminee.');
  if (ioInstance) {
    ioInstance.emit('happy_hour_ended', { multiplier: 1 });
  }
};
