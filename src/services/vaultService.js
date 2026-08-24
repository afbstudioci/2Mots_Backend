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

// Secours logique d'extrême urgence si le réseau et le disque sont inaccessibles
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
    } catch {
      // Continuer
    }
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

  // 1. Chargement instantané depuis le disque local si présent
  try {
    const localPath = path.join(__dirname, '..', 'data', 'vault', `${tier.name}.json`);
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryVault.set(tier.name, parsed);
        console.log(`[VAULT] Succès: Tier ${tier.name} chargé en mémoire locale (${parsed.length} énigmes réelles).`);
      }
    }
  } catch (e) {
    // Continuer sur GitHub
  }

  // 2. Synchronisation et enrichissement depuis GitHub
  const candidateUrls = [
    `${RELEASE_URL_BASE}/${tier.name}.json.gz`,
    `${RELEASE_URL_BASE}/${tier.name}.json`,
    `${RAW_URL_BASE}/${tier.name}.json.gz`,
    `${RAW_URL_BASE}/${tier.name}.json`,
    `https://raw.githubusercontent.com/afbstudioci/2mots-vault/main/${tier.name}.json.gz`,
    `https://raw.githubusercontent.com/afbstudioci/2mots-vault/main/${tier.name}.json`
  ];

  try {
    for (const url of candidateUrls) {
      try {
        const buffer = await fetchUrlBuffer(url);
        const parsed = parseBuffer(buffer);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryVault.set(tier.name, parsed);
          console.log(`[VAULT] Succès: Tier ${tier.name} synchronisé depuis GitHub (${parsed.length} énigmes réelles).`);
          return;
        }
      } catch {
        // Tentative suivante
      }
    }
  } catch (err) {
    console.warn(`[VAULT] Synchronisation GitHub indisponible pour ${tier.name}.`);
  } finally {
    isDownloading.set(tier.name, false);
    if (!inMemoryVault.has(tier.name)) {
      inMemoryVault.set(tier.name, FALLBACK_LOGICAL);
    }
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

  // Si le joueur a terminé toutes les énigmes de son palier, on repart sur le pool complet
  if (available.length === 0) {
    available = pool;
  }

  const picked = shuffleArray(available).slice(0, batchSize);

  // Clé dorée : 25% de chance par partie, position aléatoire
  const shouldSpawnKey = Math.random() < 0.25;
  const keyPosition = shouldSpawnKey ? (Math.floor(Math.random() * (picked.length - 8)) + 4) : -1;

  return picked.map((item, pos) => {
    const [id, word1, word2, answer, clue, difficulty, type, dist1, dist2] = item;
    const rawType = String(type || '').toLowerCase();
    const expectedType = rawType.startsWith('v') ? 'verbe' : (rawType.startsWith('adj') ? 'adjectif' : 'nom');
    return {
      _id: `vlt_${id}`,
      numericId: id,
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
