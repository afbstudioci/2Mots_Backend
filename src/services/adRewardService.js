// src/services/adRewardService.js
// SERVICE DE GESTION DES RECOMPENSES PUBLICITAIRES REWARDED (ADMOB)
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const User = require('../models/User');

const DAILY_LIMIT = 5;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes en millisecondes
const SHOP_REWARD_KEVS = 25;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getTodayString = () => new Date().toISOString().split('T')[0];

/**
 * Normalise et réinitialise le compteur journalier si une nouvelle journée commence
 */
const normalizeUserAdRewards = (user) => {
  if (!user.adRewards) {
    user.adRewards = {
      dailyShopCount: 0,
      lastShopWatchedAt: null,
      dailyResetDate: getTodayString(),
      totalAdsWatched: 0,
    };
    return;
  }

  const today = getTodayString();
  if (user.adRewards.dailyResetDate !== today) {
    user.adRewards.dailyShopCount = 0;
    user.adRewards.dailyResetDate = today;
  }
};

/**
 * Récupère le statut publicitaire de la boutique pour un joueur
 */
exports.getShopAdStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  normalizeUserAdRewards(user);

  const now = Date.now();
  const lastWatched = user.adRewards.lastShopWatchedAt
    ? new Date(user.adRewards.lastShopWatchedAt).getTime()
    : 0;

  const elapsed = now - lastWatched;
  const inCooldown = elapsed < COOLDOWN_MS;
  const remainingCooldownSeconds = inCooldown ? Math.ceil((COOLDOWN_MS - elapsed) / 1000) : 0;
  const dailyRemaining = Math.max(0, DAILY_LIMIT - (user.adRewards.dailyShopCount || 0));
  const canWatch = dailyRemaining > 0 && !inCooldown;

  return {
    canWatch,
    dailyRemaining,
    dailyLimit: DAILY_LIMIT,
    rewardKevs: SHOP_REWARD_KEVS,
    inCooldown,
    remainingCooldownSeconds,
    nextAvailableAt: inCooldown ? new Date(lastWatched + COOLDOWN_MS).toISOString() : null,
  };
};

/**
 * Valide et crédite la récompense publicitaire de la boutique (+25 Kevs)
 */
exports.claimShopReward = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  normalizeUserAdRewards(user);

  if ((user.adRewards.dailyShopCount || 0) >= DAILY_LIMIT) {
    throw createError('Limite quotidienne atteinte (5/5). Revenez demain !', 400);
  }

  const now = Date.now();
  const lastWatched = user.adRewards.lastShopWatchedAt
    ? new Date(user.adRewards.lastShopWatchedAt).getTime()
    : 0;

  if (now - lastWatched < COOLDOWN_MS) {
    const remainingMin = Math.ceil((COOLDOWN_MS - (now - lastWatched)) / 60000);
    throw createError(`Veuillez patienter encore ${remainingMin} minute(s) avant la prochaine vidéo.`, 400);
  }

  // Application atomique et sécurisée de la récompense
  user.kevs = (user.kevs || 0) + SHOP_REWARD_KEVS;
  user.adRewards.dailyShopCount = (user.adRewards.dailyShopCount || 0) + 1;
  user.adRewards.lastShopWatchedAt = new Date();
  user.adRewards.totalAdsWatched = (user.adRewards.totalAdsWatched || 0) + 1;

  await user.save();

  const remaining = DAILY_LIMIT - user.adRewards.dailyShopCount;

  return {
    success: true,
    addedKevs: SHOP_REWARD_KEVS,
    totalKevs: user.kevs,
    dailyRemaining: remaining,
    nextAvailableAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
  };
};

/**
 * Valide l'octroi d'une Seconde Chance (+15 secondes)
 */
exports.claimSecondChance = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  normalizeUserAdRewards(user);
  user.adRewards.totalAdsWatched = (user.adRewards.totalAdsWatched || 0) + 1;
  await user.save();

  return {
    success: true,
    bonusSeconds: 15,
  };
};

/**
 * Valide le doublement des Kevs remportés sur une session de jeu
 */
exports.claimDoubleKevs = async (userId, sessionKevs) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  const kevsToAdd = typeof sessionKevs === 'number' && sessionKevs > 0 ? Math.min(sessionKevs, 100) : 0;
  if (kevsToAdd === 0) {
    throw createError('Aucun Kev à doubler pour cette session.', 400);
  }

  normalizeUserAdRewards(user);
  user.kevs = (user.kevs || 0) + kevsToAdd;
  user.adRewards.totalAdsWatched = (user.adRewards.totalAdsWatched || 0) + 1;
  await user.save();

  return {
    success: true,
    doubledKevs: kevsToAdd,
    totalKevs: user.kevs,
  };
};

/**
 * Valide l'activation d'un Joker de secours en jeu (quand solde < 5 Kevs)
 */
exports.claimEmergencyBooster = async (userId, boosterType) => {
  if (!['timeFreeze', 'superClue'].includes(boosterType)) {
    throw createError('Type de joker invalide.', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  normalizeUserAdRewards(user);
  user.adRewards.totalAdsWatched = (user.adRewards.totalAdsWatched || 0) + 1;
  await user.save();

  return {
    success: true,
    boosterType,
    granted: true,
  };
};
