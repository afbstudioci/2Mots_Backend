// src/services/vipService.js
// SERVICE D'INTELLIGENCE DU CYCLE DE VIE DES ABONNEMENTS VIP
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const User = require('../models/User');
const expoPushService = require('./expoPushService');

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

/**
 * Traite un lot d'utilisateurs VIP pour une étape de cycle de vie donnée
 */
const processVipBatch = async (filter, stageNum, nextStage, title, body, extraUpdates = {}) => {
  let skip = 0;
  let totalProcessed = 0;

  while (true) {
    const users = await User.find(filter)
      .select('_id pushTokens fcmToken login isVip vipExpiresAt')
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (!users || users.length === 0) break;

    const userIds = users.map((u) => String(u._id));

    // Envoi du push groupe haute priorite
    await expoPushService.sendAndroidPushNotification({
      userIds,
      title,
      body,
      data: { type: 'vip_reminder', screen: 'Shop' },
    });

    // Mise a jour de l'etat du cycle VIP
    await User.updateMany(
      { _id: { $in: userIds } },
      {
        vipReminderStage: nextStage,
        lastVipPushAt: new Date(),
        ...extraUpdates,
      }
    );

    totalProcessed += users.length;
    skip += BATCH_SIZE;
  }

  return totalProcessed;
};

/**
 * Routine quotidienne de controle et de relance du cycle VIP
 * (J-3, Jour J, J+2 Grace, J+3 Suspension)
 */
exports.processVipLifecycle = async () => {
  const now = new Date();
  console.log('[VIP_LIFECYCLE] Demarrage de la verification du statut des abonnements VIP...');

  try {
    // 1. Rappel J-3 (Expire dans moins de 3 jours et etape 0)
    const j3Limit = new Date(now.getTime() + 3 * DAY_MS);
    const countJ3 = await processVipBatch(
      {
        isVip: true,
        isBanned: false,
        vipExpiresAt: { $gt: now, $lte: j3Limit },
        vipReminderStage: 0,
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      0,
      1,
      'Votre Pass VIP expire dans 3 jours',
      'Pensez a le renouveler pour conserver vos avantages exclusifs (zero pub, x2 gains, Kevs quotidiens).'
    );

    // 2. Rappel Jour J (Date d'expiration atteinte et etape 1)
    const graceLimitJ0 = new Date(now.getTime() - 1 * DAY_MS);
    const countJ0 = await processVipBatch(
      {
        isVip: true,
        isBanned: false,
        vipExpiresAt: { $lte: now, $gte: graceLimitJ0 },
        vipReminderStage: { $in: [0, 1] },
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      1,
      2,
      'Votre Pass VIP arrive a echeance',
      'Votre abonnement arrive a terme aujourd’hui. Rendez-vous dans la boutique pour continuer a profiter de vos privilèges.'
    );

    // 3. Rappel J+2 : Dernier avertissement avant coupure (Etape 2)
    const graceLimitJ2 = new Date(now.getTime() - 2 * DAY_MS);
    const countJ2 = await processVipBatch(
      {
        isVip: true,
        isBanned: false,
        vipExpiresAt: { $lte: graceLimitJ2 },
        vipReminderStage: 2,
        $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
      },
      2,
      3,
      'Dernier rappel Pass VIP',
      'Votre abonnement va être suspendu dans 24h. Renouvelez-le dès maintenant pour garder vos avantages.'
    );

    // 4. J+3 : Suspension definitive et blocage du statut VIP
    const expiredCutoff = new Date(now.getTime() - 3 * DAY_MS);
    const countExpired = await processVipBatch(
      {
        isVip: true,
        vipExpiresAt: { $lte: expiredCutoff },
      },
      3,
      4,
      'Pass VIP suspendu',
      'Votre Pass VIP a expire et vos privileges ont ete suspendus. Vous pouvez le reactiver a tout moment dans la boutique.',
      { isVip: false }
    );

    console.log(
      `[VIP_LIFECYCLE] Bilan : J-3=${countJ3}, Jour-J=${countJ0}, J+2=${countJ2}, Desactives=${countExpired}`
    );

    return { countJ3, countJ0, countJ2, countExpired };
  } catch (error) {
    console.error('[VIP_LIFECYCLE] Erreur lors du traitement VIP:', error.message);
    throw error;
  }
};
