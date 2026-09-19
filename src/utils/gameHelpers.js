// src/utils/gameHelpers.js
// FONCTIONS UTILITAIRES DE GESTION DE PARTIE, VIP ET JOUEURS
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const { FALLBACK_VERBS, FALLBACK_NOUNS, FALLBACK_ADJ } = require('./gameFallbacks');

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

const shuffleArray = (array) => {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const getXpNeededForLevel = (level = 1) => {
  const currentLevel = Math.max(1, parseInt(level, 10) || 1);
  return 3 + currentLevel * 2;
};

const normalizeUserProgression = (user) => {
  if (!user) return false;
  let modified = false;
  if (!user.level || user.level < 1) {
    user.level = 1;
    modified = true;
  }
  if (user.xp === undefined || user.xp === null || user.xp < 0) {
    user.xp = 0;
    modified = true;
  }
  let needed = getXpNeededForLevel(user.level);
  while (user.xp >= needed) {
    user.xp -= needed;
    user.level += 1;
    needed = getXpNeededForLevel(user.level);
    modified = true;
  }
  return modified;
};

const applyXpGain = (user, xpGain = 0) => {
  if (!user || xpGain <= 0) return { leveledUp: false, levelsGained: 0 };
  const initialLevel = user.level || 1;
  user.xp = (user.xp || 0) + xpGain;
  normalizeUserProgression(user);
  const levelsGained = (user.level || 1) - initialLevel;
  return {
    leveledUp: levelsGained > 0,
    levelsGained,
  };
};

const enrichPairsWithOptions = (wordPairs) => {
  if (!Array.isArray(wordPairs)) return [];
  return wordPairs.map((rawPair, i) => {
    const correctAnswer = (rawPair.exactMatch && rawPair.exactMatch[0]) || rawPair.word1;
    const gramType = detectGrammaticalType(correctAnswer, rawPair.expectedType);
    let distractors = (rawPair.distractors && rawPair.distractors.length >= 2) ? [rawPair.distractors[0], rawPair.distractors[1]] : null;
    if (!distractors) {
      const poolChoice = gramType === 'verbe' ? FALLBACK_VERBS : (gramType === 'adjectif' ? FALLBACK_ADJ : FALLBACK_NOUNS);
      const filtered = shuffleArray(poolChoice.filter((w) => normalizeText(w) !== normalizeText(correctAnswer)));
      distractors = [filtered[0] || 'Choix A', filtered[1] || 'Choix B'];
    }
    return {
      _id: rawPair._id,
      word1: rawPair.word1,
      word2: rawPair.word2,
      clue: rawPair.clue,
      expectedType: gramType,
      difficulty: rawPair.difficulty,
      exactMatch: rawPair.exactMatch || [correctAnswer],
      options: shuffleArray([correctAnswer, distractors[0], distractors[1]]),
      hasKey: i === 17,
    };
  });
};

module.exports = {
  calculateCooldown,
  normalizeText,
  isVipActive,
  getGameMultipliers,
  detectGrammaticalType,
  recordPlayedWords,
  recordPlayedWordsAtomic,
  getXpNeededForLevel,
  applyXpGain,
  normalizeUserProgression,
  shuffleArray,
  enrichPairsWithOptions,
};
