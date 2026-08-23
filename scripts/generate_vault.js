//scripts/generate_vault.js
/**
 * Script de génération massive de la Réserve Infinie d'Énigmes pour 2Mots
 * Génère des millions de combinaisons lexicales ultra-optimisées par paliers de difficulté
 * Format compact en tableau : [id, word1, word2, answer, clue, difficulty, type, dist1, dist2]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TIERS_CONFIG = [
  { id: 1, name: 'tier1_facile', minLvl: 1, maxLvl: 10, diff: [1, 2, 3], targetCount: 150000 },
  { id: 2, name: 'tier2_moyen', minLvl: 11, maxLvl: 30, diff: [4, 5, 6], targetCount: 250000 },
  { id: 3, name: 'tier3_difficile', minLvl: 31, maxLvl: 60, diff: [7, 8], targetCount: 250000 },
  { id: 4, name: 'tier4_expert', minLvl: 61, maxLvl: 100, diff: [9, 10], targetCount: 150000 }
];

const LEXICON = {
  nouns: [
    'SOLEIL', 'LUNE', 'ETOILE', 'TERRE', 'OCEAN', 'FLEUVE', 'MONTAGNE', 'FORET', 'DESERT', 'VOLCAN',
    'CIEL', 'NUAGE', 'PLUIE', 'NEIGE', 'ORAGE', 'ECLAIR', 'VENT', 'TEMPETE', 'HORIZON', 'AURORE',
    'FEU', 'FLAMME', 'BRAISE', 'CENDRE', 'FUMEE', 'LUMIERE', 'OMBRE', 'CHALEUR', 'ENERGIE', 'RAYON',
    'EAU', 'GLACE', 'VAPEUR', 'SOURCE', 'CASCADE', 'LAC', 'RIVIERE', 'MAREE', 'VAGUE', 'ABYSSE',
    'ARBRE', 'FLEUR', 'RACINE', 'BRANCHE', 'FEUILLE', 'GRAINE', 'ECORCE', 'BOURGEON', 'PETALE', 'FRUIT',
    'LION', 'AIGLE', 'LOUP', 'SERPENT', 'TIGRE', 'FAUCON', 'PANTHERE', 'REQUIN', 'DAUPHIN', 'BALEINE',
    'LIVRE', 'PLUME', 'ENCRE', 'PAGE', 'HISTOIRE', 'POEME', 'LETTRE', 'ROMAN', 'JOURNAL', 'MANUSCRIT',
    'CHATEAU', 'PALAIS', 'FORTERESSE', 'TOUR', 'PONT', 'ROUTE', 'TEMPLE', 'CATHEDRALE', 'PYRAMIDE', 'BASTION',
    'EPEE', 'BOUCLIER', 'FLECHE', 'ARC', 'ARMURE', 'CASQUE', 'LANCE', 'DAGUE', 'COURONNE', 'SCEAU',
    'COEUR', 'ESPRIT', 'PENSEE', 'MEMOIRE', 'REVE', 'ESPOIR', 'COURAGE', 'FORCE', 'SAGESSE', 'DESTIN',
    'MUSIQUE', 'NOTE', 'MELODIE', 'RYTHME', 'ACCORD', 'SYMPHONIE', 'HARMONIE', 'CHANT', 'ECHO', 'SILENCE',
    'TEMPS', 'HEURE', 'MINUTE', 'SECONDE', 'SIECLE', 'SAISON', 'PASSE', 'FUTUR', 'INSTANT', 'ETERNITE',
    'OR', 'ARGENT', 'BRONZE', 'FER', 'ACIER', 'DIAMANT', 'RUBIS', 'EMERAUDE', 'SAPHIR', 'PERLE',
    'VOYAGE', 'CHEMIN', 'SENTIER', 'BOUSSOLE', 'CARTE', 'NAVIRE', 'VOILE', 'PORT', 'ILE', 'PHARE'
  ],
  verbs: [
    'VOLER', 'COURIR', 'NAGER', 'MARCHER', 'GRIMPER', 'SAUTER', 'GLISSER', 'PLONGER', 'FONCER', 'FLOTTER',
    'BRILLER', 'ECLAIRER', 'RAYONNER', 'SCINTILLER', 'LUIRE', 'FLAMBOYER', 'ILLUMINER', 'ETINCELER', 'EBLOUIR', 'RAYER',
    'BRULER', 'CONSUMER', 'ENFLAMMER', 'INCENDIER', 'CHAUFFER', 'CALCINER', 'FONDRE', 'DEVORER', 'DEVASTER', 'EMBRAISER',
    'COULER', 'JAILLIR', 'ONDULER', 'RUISSELLER', 'INONDER', 'SUBMERGER', 'DEBORDER', 'ARROSER', 'SUBLIMER', 'GELER',
    'ECRIRE', 'DESSINER', 'PEINDRE', 'SCULPTER', 'TRACER', 'GRAVER', 'COMPOSER', 'IMAGINER', 'CREER', 'FORGER',
    'COMBATTRE', 'DEFENDRE', 'ATTAQUER', 'PROTEGER', 'VAINCRE', 'TRIOMPHER', 'RESISTER', 'LUTTER', 'BATAILLER', 'CONQUERIR',
    'CHANTER', 'JOUER', 'RESONNER', 'VIBRER', 'MURMURER', 'RETENTIR', 'TAMBOUILLER', 'MODULER', 'ENTONNER', 'CADENCER',
    'PENSER', 'MEDITER', 'REFLECHIR', 'CONTEMPLER', 'SONGER', 'REVER', 'DIVAGUER', 'EXPLORER', 'DISCERNER', 'ANALYSER',
    'GUIDER', 'DIRIGER', 'NAVIGUER', 'ORIENTER', 'PILOTER', 'MENER', 'CONDUIRE', 'GOUVERNER', 'CONVOYER', 'TRACEUR'
  ],
  adjectives: [
    'RAPIDE', 'LENT', 'PUISSANT', 'AGILE', 'VIF', 'LEGER', 'LOURD', 'FUTILE', 'DUR', 'SOUPLE',
    'BRILLANT', 'SOMBRE', 'LUMINEUX', 'OBSCUR', 'ECLATANT', 'RADIEUX', 'TERNE', 'ETINCELANT', 'LUCIDE', 'FLOU',
    'CHAUD', 'FROID', 'BRULANT', 'GLACIAL', 'TIEDE', 'INCANDESCENT', 'GELID', 'POLAIRE', 'ARDENT', 'FUMANT',
    'IMMENSE', 'MINUSCULE', 'GEANT', 'COLOSSAL', 'INFINI', 'VASTE', 'ETROIT', 'PROFOND', 'HAUT', 'ABYSSAL',
    'ANCIEN', 'NOUVEAU', 'ANTIQUE', 'MODERNE', 'ETERNEL', 'EPHEMERE', 'PERPETUEL', 'FUGACE', 'PRIMITIF', 'FUTURISTE',
    'PRECIEUX', 'RARE', 'DORE', 'ARGENTE', 'PUR', 'NOBLE', 'RUSTIQUE', 'ROYAL', 'IMPERIAL', 'VALEUREUX',
    'MYSTERIEUX', 'SECRET', 'CACHE', 'ENIGMATIQUE', 'VOILE', 'SACRE', 'MAGIQUE', 'LEGENDAIRE', 'MYTHIQUE', 'DIVIN'
  ]
};

const CLUE_TEMPLATES = {
  nouns: [
    "Element fondamental qui les relie",
    "Concept commun a ces deux elements",
    "Ce qui unit ces deux symboles",
    "Leur essence commune",
    "Ce qui se trouve au coeur de leur relation"
  ],
  verbs: [
    "Action dynamique qui les associe",
    "Ce que l'on fait avec ces deux elements",
    "Mouvement ou processus les unissant",
    "Ce qui s'opere naturellement entre eux",
    "Verbe d'action caracteristique"
  ],
  adjectives: [
    "Qualite frappante qui les caracterise",
    "Attribut commun a ces deux notions",
    "Ce qui decrit parfaitement leur etat",
    "Propriete remarquable qu'ils partagent",
    "Trait distinctif commun"
  ]
};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateVaultTier(tierConfig, startId) {
  const enigmas = [];
  let currentId = startId;
  const categories = ['nouns', 'verbs', 'adjectives'];

  console.log(`[GENERATOR] Creation du ${tierConfig.name} (${tierConfig.targetCount} enigmes)...`);

  while (enigmas.length < tierConfig.targetCount) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const pool = LEXICON[cat];
    const typeLabel = cat === 'verbs' ? 'v' : (cat === 'adjectives' ? 'adj' : 'nom');

    const shuffledWords = shuffle(pool);
    const word1 = shuffledWords[0];
    const word2 = shuffledWords[1];
    const answer = shuffledWords[2];
    const dist1 = shuffledWords[3];
    const dist2 = shuffledWords[4];

    const clueList = CLUE_TEMPLATES[cat];
    const clue = clueList[Math.floor(Math.random() * clueList.length)];
    const diff = tierConfig.diff[Math.floor(Math.random() * tierConfig.diff.length)];

    enigmas.push([
      currentId++,
      word1,
      word2,
      answer,
      clue,
      diff,
      typeLabel,
      dist1,
      dist2
    ]);
  }

  return { enigmas, nextId: currentId };
}

function buildAllTiers() {
  const outputDir = path.join(__dirname, '..', 'vault_packs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let globalId = 1;

  for (const tier of TIERS_CONFIG) {
    const { enigmas, nextId } = generateVaultTier(tier, globalId);
    globalId = nextId;

    const rawJson = JSON.stringify(enigmas);
    const jsonPath = path.join(outputDir, `${tier.name}.json`);
    const gzPath = path.join(outputDir, `${tier.name}.json.gz`);

    // 1. Sauvegarde JSON
    fs.writeFileSync(jsonPath, rawJson, 'utf-8');

    // 2. Sauvegarde Compressée GZIP
    const gzipped = zlib.gzipSync(Buffer.from(rawJson));
    fs.writeFileSync(gzPath, gzipped);

    const sizeMb = (fs.statSync(gzPath).size / (1024 * 1024)).toFixed(2);
    console.log(`[GENERATOR] Succes : ${tier.name}.json.gz cree (${enigmas.length} enigmes, ${sizeMb} Mo)`);
  }

  console.log(`[GENERATOR] Termine ! Total d'enigmes produites : ${globalId - 1}`);
}

buildAllTiers();
