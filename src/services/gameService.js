// src/services/gameService.js
// SERVICE METIER DE GESTION DES PARTIES ET DU GAMING (MODE FORTERESSE)
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const WordPair = require('../models/WordPair');
const User = require('../models/User');
const missionService = require('./missionService');
const vaultService = require('./vaultService');
const happyHourService = require('./happyHourService');
const { FALLBACK_VERBS, FALLBACK_NOUNS, FALLBACK_ADJ } = require('../utils/gameFallbacks');
const {
  normalizeText,
  getGameMultipliers,
  detectGrammaticalType,
  recordPlayedWords,
  recordPlayedWordsAtomic,
} = require('../utils/gameHelpers');

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const enrichPairsWithOptions = async (wordPairs) => {
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

const checkAnswerRealtime = async (userId, wordPairId, userAnswer, timeSpent) => {
  const pair = String(wordPairId).startsWith('vlt_') ? vaultService.findEnigma(wordPairId) : await WordPair.findById(wordPairId);
  const resolvedPair = pair || { _id: wordPairId, exactMatch: [userAnswer], clue: '' };
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  const normalizedAnswer = normalizeText(userAnswer);
  const checkArray = (arr) => (arr && Array.isArray(arr) ? arr.map(normalizeText).includes(normalizedAnswer) : false);
  let isCorrect = false, points = 0, accuracy = 0;

  if (checkArray(resolvedPair.exactMatch)) { isCorrect = true; points = 10; accuracy = 100; }
  else if (checkArray(resolvedPair.closeMatch)) { isCorrect = true; points = 8; accuracy = 80; }
  else if (checkArray(resolvedPair.partialMatch)) { isCorrect = true; points = 5; accuracy = 50; }

  let timeWon = 0, earnedKevs = 0, leveledUp = false, isFastCombo = false;
  if (isCorrect) {
    await missionService.updateMissionProgress(userId, 'words_solved');
    const hhMultiplier = happyHourService.getHappyHourMultiplier();
    const { totalMultiplier, isVip, vipMultiplier } = getGameMultipliers(user, hhMultiplier);
    isFastCombo = timeSpent <= 3.5;
    const totalSolved = (user.playedWords ? user.playedWords.length : 0) + 1;
    const baseKevs = isFastCombo ? 1 : (totalSolved % 2 === 0 ? 1 : 0);
    earnedKevs = baseKevs * totalMultiplier;
    user.kevs = (user.kevs || 0) + earnedKevs;

    const earnedXp = (isFastCombo ? 2 : 1) * hhMultiplier;
    user.xp = (user.xp || 0) + earnedXp;

    const enigmasNeeded = 3 + user.level * 2;
    if (user.xp >= enigmasNeeded) {
      user.level += 1;
      user.xp -= enigmasNeeded;
      leveledUp = true;
      const levelBonus = 5 * totalMultiplier;
      earnedKevs += levelBonus;
      user.kevs += levelBonus;
      await missionService.updateMissionProgress(userId, 'levels_reached');
    }
    timeWon = timeSpent <= 5 ? 8 : (timeSpent <= 15 ? 5 : 3);
  }

  recordPlayedWords(user, [resolvedPair._id]);

  const latest = await User.findById(userId).select('level xp kevs');
  if (latest) {
    if (latest.level > user.level) {
      user.level = latest.level;
      user.xp = latest.xp;
    } else if (latest.level === user.level && latest.xp > user.xp) {
      user.xp = latest.xp;
    }
    if (latest.kevs > user.kevs) {
      user.kevs = latest.kevs;
    }
  }

  await user.save();
  const officialAnswer = (resolvedPair.exactMatch && resolvedPair.exactMatch[0]) || resolvedPair.word1;

  return {
    isCorrect,
    correctAnswer: officialAnswer,
    points,
    accuracy,
    timeWon,
    earnedKevs,
    isFastCombo,
    totalKevs: user.kevs,
    leveledUp,
    newLevel: user.level,
    currentXp: user.xp,
    xpNeeded: 3 + user.level * 2,
    logicalHint: resolvedPair.clue,
  };
};

const useHint = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);
  if (user.kevs < 5) throw createError('Kevs insuffisants. 5 Kevs requis.', 400);
  user.kevs -= 5;
  await user.save();
  return { kevs: user.kevs };
};

const validateFinalSession = async (userId, sessionData = {}) => {
  const { answers = [], score: directScore, kevyKeys, bonusKevs = 0, level: clientLevel, xp: clientXp } = sessionData;
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);

  let calculatedScore = 0;
  let sessionBaseKevs = 0;
  const corrections = [];

  if (Array.isArray(answers) && answers.length > 0) {
    recordPlayedWords(user, answers.map((a) => a.wordPairId));
    let correctCount = 0;
    for (const item of answers) {
      if (item.isCorrect) {
        correctCount += 1;
        calculatedScore += 1;
        const isFast = item.timeSpent && item.timeSpent <= 3.5;
        sessionBaseKevs += (isFast ? 1 : (correctCount % 2 === 0 ? 1 : 0));
      } else if (item.wordPairId) {
        const pair = String(item.wordPairId).startsWith('vlt_') ? vaultService.findEnigma(item.wordPairId) : await WordPair.findById(item.wordPairId);
        if (pair) {
          corrections.push({
            word1: pair.word1,
            word2: pair.word2,
            expectedAnswer: (pair.exactMatch && pair.exactMatch[0]) || 'Inconnu',
            userAnswer: item.answer || 'Temps écoulé',
          });
        }
      }
    }
  }

  const sessionScore = typeof directScore === 'number' && directScore >= 0 ? directScore : calculatedScore;
  if (sessionScore > (user.bestScore || 0)) user.bestScore = sessionScore;
  if (typeof kevyKeys === 'number' && kevyKeys >= 0 && kevyKeys <= 3) user.kevyKeys = kevyKeys;

  const hhMultiplier = happyHourService.getHappyHourMultiplier();
  const { isVip, vipMultiplier, totalMultiplier } = getGameMultipliers(user, hhMultiplier);

  // Recalcul sécurisé des gains de session avec multiplicateur VIP x2
  let sessionEarnedKevs = sessionBaseKevs * totalMultiplier;
  if (typeof bonusKevs === 'number' && bonusKevs > 0) {
    sessionEarnedKevs += bonusKevs;
  }

  // Si des gains de session sont calculés, mise à jour atomique sécurisée
  if (sessionEarnedKevs > 0) {
    user.kevs = (user.kevs || 0) + sessionEarnedKevs;
  }

  if (typeof clientLevel === 'number' && clientLevel > (user.level || 1)) {
    user.level = clientLevel;
    user.xp = typeof clientXp === 'number' ? clientXp : 0;
  } else if (typeof clientLevel === 'number' && clientLevel === (user.level || 1) && typeof clientXp === 'number' && clientXp > (user.xp || 0)) {
    user.xp = clientXp;
  }

  await user.save();

  return {
    totalScore: sessionScore,
    bestScore: user.bestScore,
    corrections,
    kevs: user.kevs,
    kevyKeys: user.kevyKeys,
    level: user.level,
    xp: user.xp,
    earnedKevs: sessionEarnedKevs,
    isVip,
    vipMultiplier,
  };
};

const syncLevel = async (userId, level, xp, kevs) => {
  if (typeof level !== 'number' || level < 1) return;
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { level: { $lt: level } },
        { level, xp: { $lte: xp || 0 } },
      ],
    },
    {
      $set: { level, xp: xp || 0 },
      ...(typeof kevs === 'number' && kevs > 0 ? { $max: { kevs } } : {}),
    },
    { new: true }
  );
  const user = updated || (await User.findById(userId));
  return { level: user.level, xp: user.xp, kevs: user.kevs };
};

const syncOfflineSession = async (userId, sessionData) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);
  const { rounds } = sessionData;
  if (!rounds || !Array.isArray(rounds)) throw createError('Session invalide', 400);

  const hhMultiplier = happyHourService.getHappyHourMultiplier();
  const { isVip, vipMultiplier, totalMultiplier } = getGameMultipliers(user, hhMultiplier);

  let calculatedScore = 0;
  let earnedKevs = 0;

  for (const r of rounds) {
    if (r.isCorrect) {
      calculatedScore += 1;
      const isFast = r.timeSpentMs && r.timeSpentMs <= 3500;
      const baseKev = isFast ? 1 : (calculatedScore % 2 === 0 ? 1 : 0);
      earnedKevs += baseKev * totalMultiplier;
    }
  }

  user.kevs = (user.kevs || 0) + earnedKevs;
  if (calculatedScore > (user.bestScore || 0)) user.bestScore = calculatedScore;
  await user.save();

  return {
    synced: true,
    earnedKevs,
    totalKevs: user.kevs,
    isVip,
    vipMultiplier,
  };
};

const claimChestReward = async (userId, gains) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);
  user.kevyKeys = 0;
  if (gains && typeof gains.kevs === 'number' && gains.kevs > 0) user.kevs = (user.kevs || 0) + gains.kevs;
  await user.save();
  return { kevyKeys: 0, kevs: user.kevs };
};

const syncUserKeys = async (userId, kevyKeys) => {
  const user = await User.findById(userId);
  if (!user) throw createError('Utilisateur introuvable', 404);
  if (typeof kevyKeys === 'number' && kevyKeys >= 0 && kevyKeys <= 3) {
    user.kevyKeys = kevyKeys;
    await user.save();
  }
  return { kevyKeys: user.kevyKeys };
};

module.exports = {
  recordPlayedWords,
  recordPlayedWordsAtomic: (userId, items) => recordPlayedWordsAtomic(userId, items, User),
  enrichPairsWithOptions,
  checkAnswerRealtime,
  useHint,
  validateFinalSession,
  syncLevel,
  syncOfflineSession,
  claimChestReward,
  syncUserKeys,
};