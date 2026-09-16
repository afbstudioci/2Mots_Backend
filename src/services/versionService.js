// src/services/versionService.js
// SERVICE DE GESTION DU VERSIONING ET DE LA DIFFUSION DES MISES A JOUR PUSH
// Standard : Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const { sendAndroidPushNotification } = require('./expoPushService');

const DEFAULT_STORE_URL = 'https://play.google.com/store/apps/details?id=com.afbstudio.twomots';
const SETTING_KEY_LAST_BROADCASTED_VERSION = 'last_broadcasted_version_code';
const BATCH_SIZE = 100;

/**
 * Diffuse une notification push a tous les utilisateurs dont la version est inferieure au targetVersionCode
 * @param {object} params
 * @param {number} params.targetVersionCode
 * @param {string} [params.title]
 * @param {string} [params.message]
 * @param {string} [params.storeUrl]
 */
exports.broadcastUpdate = async ({
  targetVersionCode,
  title,
  message,
  storeUrl,
} = {}) => {
  const code =
    parseInt(targetVersionCode, 10) ||
    parseInt(process.env.LATEST_VERSION_CODE, 10) ||
    42;

  const pushTitle =
    title ||
    process.env.UPDATE_TITLE ||
    'Mise à jour disponible';

  const pushMessage =
    message ||
    process.env.UPDATE_MESSAGE ||
    'Une nouvelle version de 2Mots est disponible sur le Play Store. Mettez à jour votre jeu pour profiter des nouveautés !';

  const pushStoreUrl = storeUrl || process.env.STORE_URL || DEFAULT_STORE_URL;

  console.log(`[VERSION_SERVICE] Lancement de la diffusion push pour la version ${code}...`);

  const outdatedUsers = await User.find({
    isBanned: false,
    appVersionCode: { $lt: code },
    $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
  })
    .select('_id')
    .lean();

  const userIds = outdatedUsers.map((u) => String(u._id));
  let sentCount = 0;

  if (userIds.length > 0) {
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchIds = userIds.slice(i, i + BATCH_SIZE);
      await sendAndroidPushNotification({
        userIds: batchIds,
        title: pushTitle,
        body: pushMessage,
        data: {
          type: 'app_update',
          targetVersionCode: String(code),
          storeUrl: pushStoreUrl,
        },
      });
      sentCount += batchIds.length;
    }
  }

  // Memorisation en base de la derniere version diffusee
  await SystemSetting.findOneAndUpdate(
    { key: SETTING_KEY_LAST_BROADCASTED_VERSION },
    {
      key: SETTING_KEY_LAST_BROADCASTED_VERSION,
      value: code,
      description: 'Dernier versionCode ayant fait l\'objet d\'une diffusion push automatique',
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  console.log(`[VERSION_SERVICE] Diffusion terminee : ${sentCount} joueur(s) cible(s) pour la version ${code}.`);

  return {
    targetedCount: sentCount,
    targetVersionCode: code,
  };
};

/**
 * Routine de verification au demarrage du serveur :
 * Si le versionCode defini dans l'environnement est superieur a la derniere version diffusee,
 * une notification push globale est automatiquement envoyee aux versions obsoletes.
 */
exports.checkAndBroadcastOnStartup = async () => {
  try {
    const currentLatestCode = parseInt(process.env.LATEST_VERSION_CODE, 10) || 42;

    const setting = await SystemSetting.findOne({ key: SETTING_KEY_LAST_BROADCASTED_VERSION }).lean();

    if (!setting) {
      // Premier demarrage avec le nouveau systeme : enregistrement du jalon initial
      await SystemSetting.create({
        key: SETTING_KEY_LAST_BROADCASTED_VERSION,
        value: currentLatestCode,
        description: 'Jalon initial du versionCode diffuse',
      });
      console.log(`[VERSION_SERVICE] Jalon initial de version enregistre : ${currentLatestCode}`);
      return;
    }

    const lastBroadcastedCode = parseInt(setting.value, 10) || 0;

    if (currentLatestCode > lastBroadcastedCode) {
      console.log(
        `[VERSION_SERVICE] Nouvelle version detectee (${currentLatestCode} > ${lastBroadcastedCode}). Demarrage du push automatique...`
      );
      await exports.broadcastUpdate({ targetVersionCode: currentLatestCode });
    } else {
      console.log(
        `[VERSION_SERVICE] Version serveur a jour (${currentLatestCode}). Aucune diffusion requise.`
      );
    }
  } catch (error) {
    console.error('[VERSION_SERVICE] Erreur verification au demarrage:', error.message);
  }
};
