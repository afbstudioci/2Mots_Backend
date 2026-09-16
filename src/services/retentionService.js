// src/services/retentionService.js
// SERVICE DE GESTION DE LA RETENTION ET DES RAPPELS D'INACTIVITE
// Standard : Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const User = require('../models/User');
const expoPushService = require('./expoPushService');
const notificationService = require('./notificationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

/**
 * Met a jour l'activite de l'utilisateur et attribue le cadeau de retour si eligible
 * @param {string} userId
 */
exports.trackUserActivity = async (userId) => {
  try {
    const user = await User.findById(userId).select('lastActiveAt inactivityReminderStage returnGiftClaimable kevs login');
    if (!user) return null;

    const now = new Date();
    const updates = { lastActiveAt: now };
    let giftAwarded = false;

    // Si le joueur etait inactif, reinitialisation de l'etape de rappel
    if (user.inactivityReminderStage > 0) {
      updates.inactivityReminderStage = 0;
    }

    // Attribution automatique du cadeau de retour (50 Kevs) si eligible
    if (user.returnGiftClaimable) {
      updates.returnGiftClaimable = false;
      updates.$inc = { kevs: 50 };
      giftAwarded = true;
    }

    await User.findByIdAndUpdate(userId, updates);

    if (giftAwarded) {
      await notificationService.sendNotification(
        userId,
        'Cadeau de bon retour !',
        'Bon retour parmi nous ! 50 Kevs bonus ont ete ajoutes a votre solde.',
        'return_gift',
        { bonusKevs: '50' }
      );
      console.log(`[RETENTION] 50 Kevs de retour attribues a ${user.login} (${userId})`);
    }

    return { giftAwarded, bonusKevs: giftAwarded ? 50 : 0 };
  } catch (error) {
    console.warn('[RETENTION] Erreur trackUserActivity:', error.message);
    return null;
  }
};

/**
 * Traite un lot d'utilisateurs inactifs pour une etape donnee
 */
const processStageBatch = async (filter, stageNum, nextStage, title, body, type, extraUpdates = {}) => {
  let skip = 0;
  let totalProcessed = 0;

  while (true) {
    const users = await User.find(filter)
      .select('_id pushTokens fcmToken login')
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (!users || users.length === 0) break;

    const userIds = users.map((u) => String(u._id));

    // Envoi du push groupe en haute priorite
    await expoPushService.sendAndroidPushNotification({
      userIds,
      title,
      body,
      data: { type, screen: 'Home' },
    });

    // Mise a jour en masse des etats de rappel
    await User.updateMany(
      { _id: { $in: userIds } },
      {
        inactivityReminderStage: nextStage,
        lastInactivityPushAt: new Date(),
        ...extraUpdates,
      }
    );

    totalProcessed += users.length;
    skip += BATCH_SIZE;
  }

  return totalProcessed;
};

/**
 * Routine d'execution des rappels d'inactivite (J+3, J+7, J+14)
 */
exports.processInactivityReminders = async () => {
  const now = Date.now();
  console.log('[RETENTION_CRON] Lancement de la verification des inactifs...');

  try {
    // 1. Rappel J+3 (Inactif depuis >= 3 jours et etape 0)
    const thresholdJ3 = new Date(now - 3 * DAY_MS);
    const countJ3 = await processStageBatch(
      {
        isBanned: false,
        lastActiveAt: { $lte: thresholdJ3 },
        inactivityReminderStage: 0,
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      0,
      1,
      "Vos neurones s'ennuient !",
      'Un defi rapide vous attend sur 2Mots. Venez tester vos competences !',
      'retention_j3'
    );

    // 2. Rappel J+7 (Inactif depuis >= 7 jours et etape 1, au moins 3 jours apres J+3)
    const thresholdJ7 = new Date(now - 7 * DAY_MS);
    const lastPushThresholdJ7 = new Date(now - 3 * DAY_MS);
    const countJ7 = await processStageBatch(
      {
        isBanned: false,
        lastActiveAt: { $lte: thresholdJ7 },
        inactivityReminderStage: 1,
        lastInactivityPushAt: { $lte: lastPushThresholdJ7 },
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      1,
      2,
      'Votre place est menacee !',
      'Vos rivaux progressent au classement. Venez defendre votre rang sur 2Mots !',
      'retention_j7'
    );

    // 3. Rappel J+14 avec Cadeau de Retour (Inactif depuis >= 14 jours et etape 2)
    const thresholdJ14 = new Date(now - 14 * DAY_MS);
    const lastPushThresholdJ14 = new Date(now - 6 * DAY_MS);
    const countJ14 = await processStageBatch(
      {
        isBanned: false,
        lastActiveAt: { $lte: thresholdJ14 },
        inactivityReminderStage: 2,
        lastInactivityPushAt: { $lte: lastPushThresholdJ14 },
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      2,
      3,
      'Vous nous manquez ! 50 Kevs offerts',
      'Un cadeau de retour de 50 Kevs vous attend si vous jouez une partie aujourd\'hui !',
      'retention_j14',
      { returnGiftClaimable: true }
    );

    console.log(`[RETENTION_CRON] Bilan : J+3=${countJ3}, J+7=${countJ7}, J+14=${countJ14}`);
    return { countJ3, countJ7, countJ14 };
  } catch (error) {
    console.error('[RETENTION_CRON] Erreur execution rappels inactifs:', error.message);
    throw error;
  }
};

/**
 * Routine quotidienne de rappel a 18h00 :
 * Cible les utilisateurs qui n'ont pas ouvert l'application aujourd'hui (lastActiveAt < debut de journee).
 * Limite a 1 notification quotidienne max via lastDailyPushAt.
 */
exports.processDailyEngagementReminders = async () => {
  console.log('[RETENTION_CRON] Verification des inactifs du jour (Rappel 18h00)...');

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const filter = {
      isBanned: false,
      lastActiveAt: { $lt: startOfToday },
      $or: [
        { lastDailyPushAt: null },
        { lastDailyPushAt: { $lt: startOfToday } },
      ],
      $and: [
        {
          $or: [
            { 'pushTokens.0': { $exists: true } },
            { fcmToken: { $ne: null } },
          ],
        },
      ],
    };

    let skip = 0;
    let totalSent = 0;
    const title = 'Votre défi quotidien vous attend !';
    const body = 'Une partie rapide vous attend sur 2Mots. Venez tester vos neurones ce soir !';

    while (true) {
      const users = await User.find(filter)
        .select('_id pushTokens fcmToken login')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (!users || users.length === 0) break;

      const userIds = users.map((u) => String(u._id));

      await expoPushService.sendAndroidPushNotification({
        userIds,
        title,
        body,
        data: { type: 'daily_reminder', screen: 'Home' },
      });

      await User.updateMany(
        { _id: { $in: userIds } },
        { lastDailyPushAt: new Date() }
      );

      totalSent += users.length;
      skip += BATCH_SIZE;
    }

    console.log(`[RETENTION_CRON] Rappel quotidien 18h diffuse a ${totalSent} utilisateur(s).`);
    return totalSent;
  } catch (error) {
    console.error('[RETENTION_CRON] Erreur rappel quotidien 18h:', error.message);
    throw error;
  }
};

