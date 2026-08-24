//src/services/vaultService.js
const https = require('https');
const http = require('http');
const zlib = require('zlib');

const RELEASE_URL_BASE = process.env.VAULT_RELEASE_URL || 'https://github.com/afbstudioci/2mots-vault/releases/latest/download';
const RAW_URL_BASE = process.env.VAULT_RAW_URL || 'https://raw.githubusercontent.com/afbstudioci/2mots-vault/main/vault_packs';

const TIER_MAPPING = [
  { id: 1, name: 'tier1_facile', minLevel: 1, maxLevel: 10 },
  { id: 2, name: 'tier2_moyen', minLevel: 11, maxLevel: 30 },
  { id: 3, name: 'tier3_difficile', minLevel: 31, maxLevel: 60 },
  { id: 4, name: 'tier4_expert', minLevel: 61, maxLevel: 999 }
];

const inMemoryVault = new Map();
const isDownloading = new Map();

// Secours logique immédiat
const FALLBACK_LOGICAL = [
  [1001, 'SOLEIL', 'PLUIE', 'ARC-EN-CIEL', 'Spectre colore qui apparait dans le ciel', 1, 'nom', 'ORAGE', 'NUAGE'],
  [1002, 'VOLANT', 'PLUME', 'BADMINTON', 'Sport de raquette rapide et aerien', 2, 'nom', 'TENNIS', 'SQUASH'],
  [1003, 'AIGUILLE', 'TISSU', 'COUDRE', 'Assembler des pieces d etoffe', 1, 'v', 'TISSER', 'BRODER'],
  [2001, 'CHAMPAGNE', 'COUPE', 'PETILLER', 'Formation de fines bulles effervescentes', 4, 'v', 'MOUSSER', 'TRINQUER'],
  [2002, 'BOUSSOLE', 'NORD', 'ORIENTER', 'Determiner la bonne trajectoire', 5, 'v', 'GUIDER', 'POINTER'],
  [3001, 'SERPENT', 'EGYPTE', 'PHARAON', 'Souverain antique protege par l ureeus', 7, 'nom', 'PYRAMIDE', 'PAPYRUS'],
  [3002, 'ECHO', 'SILENCE', 'ROMPRE', 'Mettre fin brusquement au calme ambiant', 7, 'v', 'TROUBLER', 'RESONNER'],
  [4001, 'SECRET', 'CADENAS', 'INVIOLABLE', 'Que nulle force ne peut forcer ni alterer', 9, 'adj', 'HERMETIQUE', 'IMPENETRABLE']
];

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getTierForLevel = (level = 1) => {
  const found = TIER_MAPPING.find(t => level >= t.minLevel && level <= t.maxLevel);
  return found || TIER_MAPPING[0];
};

const fetchUrlBuffer = async (targetUrl, maxRedirects = 5) => {
  if (typeof fetch === 'function') {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': '2Mots-Server' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${targetUrl}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Trop de redirections'));
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

  try {
    let buffer = null;
    try {
      buffer = await fetchUrlBuffer(`${RELEASE_URL_BASE}/${tier.name}.json.gz`);
    } catch {
      buffer = await fetchUrlBuffer(`${RAW_URL_BASE}/${tier.name}.json.gz`);
    }

    if (buffer) {
      const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
      const parsed = JSON.parse(decompressed);

      if (Array.isArray(parsed) && parsed.length > 0) {
        // Échantillon actif de 15 000 énigmes en RAM
        const sampled = shuffleArray(parsed).slice(0, 15000);
        inMemoryVault.set(tier.name, sampled);
        console.log(`[VAULT] Pack ${tier.name} charge (${parsed.length} source, ${sampled.length} en RAM).`);
        return;
      }
    }
    throw new Error('Flux vide');
  } catch (err) {
    console.warn(`[VAULT] Impossible de charger ${tier.name} (${err.message}). Utilisation fallback.`);
    const fallback = FALLBACK_LOGICAL.filter(item => Math.floor(item[0] / 1000) === tier.id);
    inMemoryVault.set(tier.name, fallback.length > 0 ? fallback : FALLBACK_LOGICAL);
  } finally {
    isDownloading.set(tier.name, false);
  }
};

exports.getEnigmaBatch = async (userLevel = 1, playedIds30Days = [], batchSize = 30) => {
  const tier = getTierForLevel(userLevel);
  if (!inMemoryVault.has(tier.name)) {
    await downloadAndCacheTier(tier);
  }

  let pool = inMemoryVault.get(tier.name);
  if (!pool || pool.length === 0) {
    pool = FALLBACK_LOGICAL;
  }

  const excludedSet = new Set(playedIds30Days.map(String));
  let available = pool.filter(item => !excludedSet.has(String(item[0])) && !excludedSet.has(`vlt_${item[0]}`));

  if (available.length < batchSize) {
    available = pool;
  }

  const picked = shuffleArray(available).slice(0, batchSize);

  // Clé dorée : Rare (25% de chance par partie) et position aléatoire entre la 5e et la 25e énigme
  const shouldSpawnKey = Math.random() < 0.25;
  const keyPosition = shouldSpawnKey ? (Math.floor(Math.random() * (picked.length - 8)) + 4) : -1;

  return picked.map((item, pos) => {
    const [id, word1, word2, answer, clue, difficulty, type, dist1, dist2] = item;
    return {
      _id: `vlt_${id}`,
      numericId: id,
      word1,
      word2,
      clue: clue || "Quel point commun les relie ?",
      expectedType: type === 'v' ? 'verbe' : (type === 'adj' ? 'adjectif' : 'nom'),
      difficulty: difficulty || 2,
      exactMatch: [answer],
      options: shuffleArray([answer, dist1 || 'Choix A', dist2 || 'Choix B']),
      hasKey: pos === keyPosition
    };
  });
};

exports.preloadAllTiers = () => {
  for (const tier of TIER_MAPPING) {
    downloadAndCacheTier(tier);
  }
};
