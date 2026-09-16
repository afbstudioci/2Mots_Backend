// src/utils/gameHelpers.js
// FONCTIONS UTILITAIRES DE GESTION DE PARTIE, VIP ET JOUEURS
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const calculateCooldown = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const normalizeText = (text) => (text || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const isVipActive = (user) => {
  if (!user || !user.isVip) return false;
  if (!user.vipExpiresAt) return true;
  return new Date(user.vipExpiresAt) > new Date();
};

const getGameMultipliers = (user, happyHourMultiplier = 1) => {
  const isVip = isVipActive(user);
  const vipMultiplier = isVip ? 2 : 1;
  const totalMultiplier = vipMultiplier * (happyHourMultiplier || 1);
  return {
    isVip,
    vipMultiplier,
    happyHourMultiplier: happyHourMultiplier || 1,
    totalMultiplier,
  };
};

const detectGrammaticalType = (word, declaredType) => {
  if (declaredType && ['verbe', 'nom', 'adjectif'].includes(declaredType.toLowerCase())) {
    return declaredType.toLowerCase();
  }
  const clean = normalizeText(word);
  return (clean.endsWith('er') || clean.endsWith('ir') || clean.endsWith('re') || clean.endsWith('oir')) ? 'verbe' : 'nom';
};

const recordPlayedWords = (user, items) => {
  if (!user.playedWords) user.playedWords = [];
  const cooldown = calculateCooldown();
  const now = new Date();
  (items || []).filter(Boolean).forEach((item) => {
    if (typeof item === 'string') {
      user.playedWords.push({ word: item, cooldownUntil: cooldown, playedAt: now });
    } else if (typeof item === 'object') {
      if (item._id) user.playedWords.push({ word: String(item._id), cooldownUntil: cooldown, playedAt: now });
      if (item.semanticSignature) user.playedWords.push({ word: String(item.semanticSignature), cooldownUntil: cooldown, playedAt: now });
    }
  });
  user.playedWords = user.playedWords.filter((pw) => pw.cooldownUntil && now < new Date(pw.cooldownUntil)).slice(-10000);
};

const recordPlayedWordsAtomic = async (userId, items, UserModel) => {
  if (!userId || !items || items.length === 0) return;
  const cooldown = calculateCooldown();
  const now = new Date();
  const newItems = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      newItems.push({ word: item, cooldownUntil: cooldown, playedAt: now });
    } else if (typeof item === 'object') {
      if (item._id) newItems.push({ word: String(item._id), cooldownUntil: cooldown, playedAt: now });
      if (item.semanticSignature) newItems.push({ word: String(item.semanticSignature), cooldownUntil: cooldown, playedAt: now });
    }
  }
  if (newItems.length === 0) return;
  await UserModel.updateOne(
    { _id: userId },
    {
      $push: {
        playedWords: {
          $each: newItems,
          $slice: -10000,
        },
      },
    }
  );
};

module.exports = {
  calculateCooldown,
  normalizeText,
  isVipActive,
  getGameMultipliers,
  detectGrammaticalType,
  recordPlayedWords,
  recordPlayedWordsAtomic,
};
