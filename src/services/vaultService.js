//src/services/vaultService.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { FALLBACK_NOUNS, FALLBACK_VERBS, FALLBACK_ADJ } = require('../utils/gameFallbacks');

const RELEASE_URL_BASE = process.env.VAULT_RELEASE_URL || 'https://github.com/afbstudioci/2mots-vault/releases/download/v1.0.0';
const RAW_URL_BASE = process.env.VAULT_RAW_URL || 'https://raw.githubusercontent.com/afbstudioci/2mots-vault/main/vault_packs';

const TIER_MAPPING = [
  { id: 1, name: 'tier1_facile', minLevel: 1, maxLevel: 10, diff: [1, 2, 3] },
  { id: 2, name: 'tier2_moyen', minLevel: 11, maxLevel: 30, diff: [4, 5, 6] },
  { id: 3, name: 'tier3_difficile', minLevel: 31, maxLevel: 60, diff: [7, 8] },
  { id: 4, name: 'tier4_expert', minLevel: 61, maxLevel: 999, diff: [9, 10] }
];

const inMemoryVault = new Map();
const isDownloading = new Map();

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

  for (let i = 0; i < 25000; i++) {
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
  console.log(`[VAULT] Reserve activee pour ${tier.name} (${enigmas.length} enigmes)`);
};

const getTierForLevel = (level = 1) => {
  const found = TIER_MAPPING.find(t => level >= t.minLevel && level <= t.maxLevel);
  return found || TIER_MAPPING[0];
};

const fetchUrlBuffer = (targetUrl, maxRedirects = 5) => {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Trop de redirections HTTP'));
    const client = targetUrl.startsWith('https') ? https : http;

    client.get(targetUrl, { headers: { 'User-Agent': '2Mots-Server' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrlBuffer(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} sur ${targetUrl}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
};

const downloadAndCacheTier = async (tier) => {
  if (inMemoryVault.has(tier.name) || isDownloading.get(tier.name)) return;
  isDownloading.set(tier.name, true);

  const localDir = path.join(__dirname, '..', '..', 'vault_packs');
  const localGz = path.join(localDir, `${tier.name}.json.gz`);

  try {
    if (fs.existsSync(localGz)) {
      const gzipped = fs.readFileSync(localGz);
      const decompressed = zlib.gunzipSync(gzipped).toString('utf-8');
      inMemoryVault.set(tier.name, JSON.parse(decompressed));
      return;
    }

    let buffer = null;
    try {
      buffer = await fetchUrlBuffer(`${RELEASE_URL_BASE}/${tier.name}.json.gz`);
    } catch {
      buffer = await fetchUrlBuffer(`${RAW_URL_BASE}/${tier.name}.json.gz`);
    }

    if (buffer) {
      const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
      inMemoryVault.set(tier.name, JSON.parse(decompressed));
      console.log(`[VAULT] Pack ${tier.name} distant charge avec succes.`);
      return;
    }
    throw new Error('Aucun flux distant');
  } catch (err) {
    autoGenerateTierInMemory(tier);
  } finally {
    isDownloading.set(tier.name, false);
  }
};

exports.getEnigmaBatch = async (userLevel = 1, playedIds30Days = [], batchSize = 30) => {
  const tier = getTierForLevel(userLevel);
  if (!inMemoryVault.has(tier.name)) {
    await downloadAndCacheTier(tier);
  }

  const pool = inMemoryVault.get(tier.name);
  if (!pool || !Array.isArray(pool) || pool.length === 0) {
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
    downloadAndCacheTier(tier);
  }
};
