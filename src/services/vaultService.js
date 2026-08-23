//src/services/vaultService.js
const { FALLBACK_NOUNS, FALLBACK_VERBS, FALLBACK_ADJ } = require('../utils/gameFallbacks');

const TIER_MAPPING = [
  { id: 1, name: 'tier1_facile', minLevel: 1, maxLevel: 10, diff: [1, 2, 3] },
  { id: 2, name: 'tier2_moyen', minLevel: 11, maxLevel: 30, diff: [4, 5, 6] },
  { id: 3, name: 'tier3_difficile', minLevel: 31, maxLevel: 60, diff: [7, 8] },
  { id: 4, name: 'tier4_expert', minLevel: 61, maxLevel: 999, diff: [9, 10] }
];

const inMemoryVault = new Map();
const POOL_SIZE_PER_TIER = 3000; // Ultra-léger en RAM (seulement ~3 Mo au total sur Render)

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const autoGenerateTierInMemory = (tier) => {
  const enigmas = [];
  const categories = ['verbs', 'nouns', 'adjectives'];
  let idCounter = tier.id * 1000000;

  for (let i = 0; i < POOL_SIZE_PER_TIER; i++) {
    const cat = categories[i % categories.length];
    const pool = cat === 'verbs' ? FALLBACK_VERBS : (cat === 'adjectives' ? FALLBACK_ADJ : FALLBACK_NOUNS);
    const type = cat === 'verbs' ? 'v' : (cat === 'adjectives' ? 'adj' : 'nom');
    const shuffled = shuffleArray(pool);

    const w1 = shuffled[0] || 'SOLEIL';
    const w2 = shuffled[1] || 'LUMIERE';
    const ans = shuffled[2] || 'RAYON';
    const d1 = shuffled[3] || 'CHALEUR';
    const d2 = shuffled[4] || 'FLAMME';

    const clue = cat === 'verbs' ? "Action fondamentale" : (cat === 'adjectives' ? "Qualite commune" : "Concept commun");
    const diff = tier.diff[i % tier.diff.length];

    enigmas.push([idCounter++, w1, w2, ans, clue, diff, type, d1, d2]);
  }

  inMemoryVault.set(tier.name, enigmas);
  console.log(`[VAULT] Reserve activee pour ${tier.name} (${enigmas.length} enigmes en RAM - conso < 1 Mo)`);
};

const getTierForLevel = (level = 1) => {
  const found = TIER_MAPPING.find(t => level >= t.minLevel && level <= t.maxLevel);
  return found || TIER_MAPPING[0];
};

exports.getEnigmaBatch = async (userLevel = 1, playedIds30Days = [], batchSize = 30) => {
  const tier = getTierForLevel(userLevel);
  if (!inMemoryVault.has(tier.name)) {
    autoGenerateTierInMemory(tier);
  }

  const activePool = inMemoryVault.get(tier.name) || [];
  const excludedSet = new Set(playedIds30Days.map(String));
  const availableIndices = [];

  for (let i = 0; i < activePool.length; i++) {
    const enigmaId = String(activePool[i][0]);
    if (!excludedSet.has(enigmaId)) {
      availableIndices.push(i);
    }
  }

  const sourceIndices = availableIndices.length >= batchSize ? availableIndices : Array.from({ length: activePool.length }, (_, k) => k);
  const pickedIndices = shuffleArray(sourceIndices).slice(0, batchSize);

  return pickedIndices.map((idx, pos) => {
    const item = activePool[idx];
    const [id, word1, word2, answer, clue, difficulty, type, dist1, dist2] = item;
    return {
      _id: `vlt_${id}`,
      numericId: id,
      word1,
      word2,
      clue: clue || "Quel point commun les relie ?",
      expectedType: type || 'nom',
      difficulty: difficulty || 2,
      exactMatch: [answer],
      options: shuffleArray([answer, dist1 || 'Choix A', dist2 || 'Choix B']),
      hasKey: pos === 17
    };
  });
};

exports.preloadAllTiers = () => {
  for (const tier of TIER_MAPPING) {
    autoGenerateTierInMemory(tier);
  }
};
