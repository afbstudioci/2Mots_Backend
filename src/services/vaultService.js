//src/services/vaultService.js
const fs = require('fs');
const path = require('path');
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

const FALLBACK_LOGICAL = [
  [1001, 'TERRE', 'LUNE', 'ORBITER', 'Mouvement perpetuel autour d un astre', 1, 'verbe', 'TOURNER', 'GRAVITER'],
  [1002, 'SOLEIL', 'TERRE', 'CHAUFFER', 'Action thermique du rayonnement stellaire', 1, 'verbe', 'RAYONNER', 'ECLAIRER'],
  [1003, 'ETOILE', 'NUIT', 'SCINTILLER', 'Effet lumineux des astres dans le ciel sombre', 2, 'verbe', 'BRILLER', 'MIROITER'],
  [1004, 'CARBONE', 'PRESSION', 'DIAMANT', 'Transformation geologique extreme menant au joyau', 1, 'nom', 'CRISTAL', 'MINERAL'],
  [2001, 'FLEUR', 'ABEILLE', 'BUTINER', 'Travailler activement le nectar des plantes', 3, 'verbe', 'VOLER', 'PIQUER'],
  [2002, 'ROMAIN', 'GLADIATEUR', 'COMBATTRE', 'L action supreme dans l arene du Colisee', 4, 'verbe', 'TRIOMPHER', 'DIVERTIR'],
  [3001, 'AIMANT', 'FER', 'ATTIRER', 'Force magnetique invisible a l oeuvre', 7, 'verbe', 'COLLER', 'CAPTURER'],
  [4001, 'SECRET', 'CADENAS', 'INVIOLABLE', 'Que nulle force ne peut forcer ni alterer', 9, 'adjectif', 'HERMETIQUE', 'IMPENETRABLE']
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

const getSemanticKey = (item) => {
  if (!item || item.length < 4) return '';
  const w1 = String(item[1] || '').trim().toUpperCase();
  const w2 = String(item[2] || '').trim().toUpperCase();
  const ans = String(item[3] || '').trim().toUpperCase();
  return `${w1}|${w2}|${ans}`;
};

const deduplicatePool = (rawArray) => {
  if (!Array.isArray(rawArray)) return [];
  const seenKeys = new Set();
  const unique = [];
  for (const item of rawArray) {
    if (!item || item.length < 4) continue;
    const key = getSemanticKey(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      unique.push(item);
    }
  }
  return unique;
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

const parseBuffer = (buf) => {
  if (!buf || buf.length === 0) return null;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      const decompressed = zlib.gunzipSync(buf).toString('utf-8');
      return JSON.parse(decompressed);
    } catch {}
  }
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    try {
      const decompressed = zlib.gunzipSync(buf).toString('utf-8');
      return JSON.parse(decompressed);
    } catch {
      return null;
    }
  }
};

const downloadAndCacheTier = async (tier) => {
  if (isDownloading.get(tier.name)) return;
  isDownloading.set(tier.name, true);

  // 1. Chargement instantané depuis le disque local
  try {
    const candidateLocalPaths = [
      path.join(__dirname, '..', '..', 'vault_packs', `${tier.name}.json.gz`),
      path.join(__dirname, '..', '..', 'vault_packs', `${tier.name}.json`),
      path.join(__dirname, '..', 'data', 'vault', `${tier.name}.json.gz`),
      path.join(__dirname, '..', 'data', 'vault', `${tier.name}.json`)
    ];
    for (const localPath of candidateLocalPaths) {
      if (fs.existsSync(localPath)) {
        const rawBuf = fs.readFileSync(localPath);
        const parsed = parseBuffer(rawBuf);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduplicated = deduplicatePool(parsed);
          inMemoryVault.set(tier.name, deduplicated);
          console.log(`[VAULT] Succès: Tier ${tier.name} chargé en local (${deduplicated.length} énigmes uniques).`);
          break;
        }
      }
    }
  } catch (e) {}

  // 2. Synchronisation distante depuis GitHub
  const candidateUrls = [
    `${RELEASE_URL_BASE}/${tier.name}.json.gz`,
    `${RELEASE_URL_BASE}/${tier.name}.json`,
    `${RAW_URL_BASE}/${tier.name}.json.gz`,
    `${RAW_URL_BASE}/${tier.name}.json`
  ];

  try {
    for (const url of candidateUrls) {
      try {
        const buffer = await fetchUrlBuffer(url);
        const parsed = parseBuffer(buffer);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduplicated = deduplicatePool(parsed);
          const currentCount = (inMemoryVault.get(tier.name) || []).length;
          // On n'écrase que si la version distante apporte autant ou plus d'énigmes uniques
          if (deduplicated.length >= currentCount) {
            inMemoryVault.set(tier.name, deduplicated);
            console.log(`[VAULT] Succès: Tier ${tier.name} synchronisé GitHub (${deduplicated.length} énigmes uniques).`);
          }
          return;
        }
      } catch {}
    }
  } catch (err) {
    console.warn(`[VAULT] Synchronisation GitHub indisponible pour ${tier.name}.`);
  } finally {
    isDownloading.set(tier.name, false);
    if (!inMemoryVault.has(tier.name)) {
      inMemoryVault.set(tier.name, deduplicatePool(FALLBACK_LOGICAL));
    }
  }
};

exports.getEnigmaBatch = async (userLevel = 1, playedRecords = [], batchSize = 30) => {
  const tier = getTierForLevel(userLevel);
  if (!inMemoryVault.has(tier.name)) {
    await downloadAndCacheTier(tier);
  }

  let pool = inMemoryVault.get(tier.name);
  if (!pool || pool.length === 0) {
    pool = deduplicatePool(FALLBACK_LOGICAL);
  }

  const excludedIds = new Set();
  const excludedSemantics = new Set();

  for (const p of playedRecords) {
    const s = String(p || '').trim().toUpperCase();
    if (!s) continue;
    if (s.startsWith('SEM:')) {
      excludedSemantics.add(s.replace('SEM:', ''));
    } else {
      excludedIds.add(s);
      excludedIds.add(s.replace('VLT_', ''));
    }
  }

  let available = pool.filter(item => {
    const id = String(item[0]);
    if (excludedIds.has(id) || excludedIds.has(`vlt_${id}`)) return false;
    const semKey = getSemanticKey(item);
    if (excludedSemantics.has(semKey)) return false;
    const pairOnlyKey = `${String(item[1] || '').trim().toUpperCase()}|${String(item[2] || '').trim().toUpperCase()}`;
    if (excludedSemantics.has(pairOnlyKey)) return false;
    return true;
  });

  if (available.length < batchSize) {
    available = pool;
  }

  const shuffled = shuffleArray(available);
  const picked = [];
  const batchWords = new Set();
  const batchAnswers = new Set();

  for (const item of shuffled) {
    if (picked.length >= batchSize) break;
    const w1 = String(item[1] || '').trim().toUpperCase();
    const w2 = String(item[2] || '').trim().toUpperCase();
    const ans = String(item[3] || '').trim().toUpperCase();

    if (batchWords.has(w1) || batchWords.has(w2) || batchAnswers.has(ans)) {
      continue;
    }

    batchWords.add(w1);
    batchWords.add(w2);
    batchAnswers.add(ans);
    picked.push(item);
  }

  if (picked.length < batchSize) {
    for (const item of shuffled) {
      if (picked.length >= batchSize) break;
      if (!picked.includes(item)) {
        picked.push(item);
      }
    }
  }

  const shouldSpawnKey = Math.random() < 0.25;
  const keyPosition = shouldSpawnKey ? (Math.floor(Math.random() * (picked.length - 8)) + 4) : -1;

  return picked.map((item, pos) => {
    const [id, word1, word2, answer, clue, difficulty, type, dist1, dist2] = item;
    const rawType = String(type || '').toLowerCase();
    const expectedType = rawType.startsWith('v') ? 'verbe' : (rawType.startsWith('adj') ? 'adjectif' : 'nom');
    const semanticSignature = `sem:${String(word1).trim().toUpperCase()}|${String(word2).trim().toUpperCase()}|${String(answer).trim().toUpperCase()}`;
    return {
      _id: `vlt_${id}`,
      numericId: id,
      semanticSignature,
      word1,
      word2,
      clue: clue || "Quel point commun les relie ?",
      expectedType,
      difficulty: difficulty || 2,
      exactMatch: [answer],
      options: shuffleArray([answer, dist1 || 'Choix A', dist2 || 'Choix B']),
      hasKey: pos === keyPosition
    };
  });
};

exports.findEnigma = (enigmaId) => {
  const numId = Number(String(enigmaId).replace('vlt_', ''));
  for (const pool of inMemoryVault.values()) {
    const found = pool.find(item => item[0] === numId);
    if (found) {
      const [id, word1, word2, answer, clue, difficulty, type, dist1, dist2] = found;
      const rawType = String(type || '').toLowerCase();
      const expectedType = rawType.startsWith('v') ? 'verbe' : (rawType.startsWith('adj') ? 'adjectif' : 'nom');
      return {
        _id: `vlt_${id}`,
        word1,
        word2,
        clue: clue || "Quel point commun les relie ?",
        expectedType,
        difficulty: difficulty || 2,
        exactMatch: [answer],
        options: [answer, dist1, dist2]
      };
    }
  }
  return null;
};

exports.preloadAllTiers = () => {
  for (const tier of TIER_MAPPING) {
    downloadAndCacheTier(tier);
  }
};

setInterval(() => {
  exports.preloadAllTiers();
}, 12 * 60 * 60 * 1000);

