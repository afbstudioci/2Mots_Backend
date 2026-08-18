//src/scripts/seedLogicalWordPairs.js
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');
const WordPair = require('../models/WordPair');
const { mongoUri } = require('../config/env');

const logicalWordPairs = [
  // NIVEAU 1 - FACILE (Relations directes et universelles)
  { word1: "soleil", word2: "mer", clue: "Lieu estival de vacances", expectedType: "nom", exactMatch: ["plage"], distractors: ["piscine", "désert"], difficulty: 1 },
  { word1: "café", word2: "matin", clue: "Action qui met fin au sommeil", expectedType: "nom", exactMatch: ["réveil"], distractors: ["sommeil", "travail"], difficulty: 1 },
  { word1: "couteau", word2: "pain", clue: "Action de séparer avec une lame", expectedType: "verbe", exactMatch: ["couper"], distractors: ["manger", "cuire"], difficulty: 1 },
  { word1: "guitare", word2: "corde", clue: "Art des sons harmonieux", expectedType: "nom", exactMatch: ["musique"], distractors: ["peinture", "danse"], difficulty: 1 },
  { word1: "pluie", word2: "ciel", clue: "Masse vaporeuse blanche ou grise", expectedType: "nom", exactMatch: ["nuage"], distractors: ["orage", "brouillard"], difficulty: 1 },
  { word1: "clé", word2: "serrure", clue: "Action de débloquer un passage", expectedType: "verbe", exactMatch: ["ouvrir"], distractors: ["fermer", "bloquer"], difficulty: 1 },
  { word1: "abeille", word2: "fleur", clue: "Substance sucrée dorée", expectedType: "nom", exactMatch: ["miel"], distractors: ["pollen", "sucre"], difficulty: 1 },
  { word1: "feu", word2: "bois", clue: "Résidu grisâtre après combustion", expectedType: "nom", exactMatch: ["cendre"], distractors: ["fumée", "flamme"], difficulty: 1 },
  { word1: "crayon", word2: "feuille", clue: "Action de tracer des lettres", expectedType: "verbe", exactMatch: ["écrire"], distractors: ["lire", "effacer"], difficulty: 1 },
  { word1: "voiture", word2: "volant", clue: "Action de diriger un véhicule", expectedType: "verbe", exactMatch: ["conduire"], distractors: ["rouler", "freiner"], difficulty: 1 },
  { word1: "chaleur", word2: "eau", clue: "Action de passer à 100 degrés", expectedType: "verbe", exactMatch: ["bouillir"], distractors: ["geler", "fondre"], difficulty: 1 },
  { word1: "livre", word2: "yeux", clue: "Action de déchiffrer un texte", expectedType: "verbe", exactMatch: ["lire"], distractors: ["écrire", "écouter"], difficulty: 1 },
  { word1: "nuit", word2: "ciel", clue: "Astre qui éclaire la nuit", expectedType: "nom", exactMatch: ["lune"], distractors: ["soleil", "étoile"], difficulty: 1 },
  { word1: "savon", word2: "eau", clue: "Action d'éliminer la saleté", expectedType: "verbe", exactMatch: ["laver"], distractors: ["sécher", "frotter"], difficulty: 1 },
  { word1: "oiseau", word2: "air", clue: "Action de se déplacer dans les airs", expectedType: "verbe", exactMatch: ["voler"], distractors: ["marcher", "nager"], difficulty: 1 },
  { word1: "dent", word2: "brosse", clue: "Pâte nettoyante mentholée", expectedType: "nom", exactMatch: ["dentifrice"], distractors: ["savon", "shampoing"], difficulty: 1 },
  { word1: "pied", word2: "sol", clue: "Action de se déplacer pas à pas", expectedType: "verbe", exactMatch: ["marcher"], distractors: ["courir", "sauter"], difficulty: 1 },
  { word1: "farine", word2: "levure", clue: "Aliment de base cuit au four", expectedType: "nom", exactMatch: ["pain"], distractors: ["gâteau", "crêpe"], difficulty: 1 },
  { word1: "lait", word2: "froid", clue: "Dessert glacé rafraîchissant", expectedType: "nom", exactMatch: ["glace"], distractors: ["fromage", "yaourt"], difficulty: 1 },
  { word1: "sport", word2: "effort", clue: "Sécrétion liquide due à la chaleur", expectedType: "nom", exactMatch: ["sueur"], distractors: ["larmes", "fatigue"], difficulty: 1 },

  // NIVEAU 2 - MOYEN (Relations causales et déductions logiques)
  { word1: "hiver", word2: "sommeil", clue: "Sommeil léthargique des animaux", expectedType: "nom", exactMatch: ["hibernation"], distractors: ["migration", "repos"], difficulty: 4 },
  { word1: "nuage", word2: "froid", clue: "Flocons blancs cristallisés", expectedType: "nom", exactMatch: ["neige"], distractors: ["grêle", "verglas"], difficulty: 4 },
  { word1: "arbre", word2: "automne", clue: "Action de perdre ses feuilles", expectedType: "verbe", exactMatch: ["tomber"], distractors: ["pousser", "fleurir"], difficulty: 4 },
  { word1: "vitesse", word2: "frein", clue: "Action de réduire l'allure", expectedType: "verbe", exactMatch: ["ralentir"], distractors: ["accélérer", "stopper"], difficulty: 4 },
  { word1: "terre", word2: "graine", clue: "Action de se développer pour une plante", expectedType: "verbe", exactMatch: ["pousser"], distractors: ["faner", "nourrir"], difficulty: 4 },
  { word1: "vent", word2: "navire", clue: "Grande pièce de tissu propulsive", expectedType: "nom", exactMatch: ["voile"], distractors: ["mât", "gouvernail"], difficulty: 4 },
  { word1: "tempête", word2: "lumière", clue: "Décharge électrique lumineuse", expectedType: "nom", exactMatch: ["éclair"], distractors: ["tonnerre", "foudre"], difficulty: 4 },
  { word1: "obscurité", word2: "pile", clue: "Appareil portatif lumineux", expectedType: "nom", exactMatch: ["lampe"], distractors: ["bougie", "allumette"], difficulty: 4 },
  { word1: "fer", word2: "humidité", clue: "Oxyde brun rougeâtre", expectedType: "nom", exactMatch: ["rouille"], distractors: ["peinture", "mousse"], difficulty: 4 },
  { word1: "plume", word2: "oiseau", clue: "Membre servant à voler", expectedType: "nom", exactMatch: ["aile"], distractors: ["bec", "patte"], difficulty: 4 },
  { word1: "pomme", word2: "terre", clue: "Force d'attraction découverte par Newton", expectedType: "nom", exactMatch: ["gravité"], distractors: ["vitesse", "chaleur"], difficulty: 4 },
  { word1: "argent", word2: "banque", clue: "Action de mettre de côté", expectedType: "verbe", exactMatch: ["économiser"], distractors: ["dépenser", "investir"], difficulty: 4 },
  { word1: "verre", word2: "choc", clue: "Action de se briser en morceaux", expectedType: "verbe", exactMatch: ["casser"], distractors: ["fissurer", "plier"], difficulty: 4 },
  { word1: "soleil", word2: "peau", clue: "Brûlure douloureuse due aux UV", expectedType: "nom", exactMatch: ["coup"], distractors: ["bronzage", "allergie"], difficulty: 4 },
  { word1: "musique", word2: "rythme", clue: "Action de bouger son corps en cadence", expectedType: "verbe", exactMatch: ["danser"], distractors: ["chanter", "jouer"], difficulty: 4 },

  // NIVEAU 3 - AVANCÉ (Concepts abstraits et associations subtiles)
  { word1: "boussole", word2: "nord", clue: "Propriété physique d'attraction", expectedType: "nom", exactMatch: ["magnétisme"], distractors: ["gravité", "électricité"], difficulty: 7 },
  { word1: "labyrinthe", word2: "fil", clue: "Action de trouver le chemin de sortie", expectedType: "verbe", exactMatch: ["guider"], distractors: ["perdre", "bloquer"], difficulty: 7 },
  { word1: "horloge", word2: "sable", clue: "Instrument mesurant un temps court", expectedType: "nom", exactMatch: ["sablier"], distractors: ["montre", "chronomètre"], difficulty: 7 },
  { word1: "miroir", word2: "fumée", clue: "Perception trompeuse de la réalité", expectedType: "nom", exactMatch: ["illusion"], distractors: ["reflet", "fantôme"], difficulty: 7 },
  { word1: "océan", word2: "lune", clue: "Mouvement oscillatoire des eaux", expectedType: "nom", exactMatch: ["marée"], distractors: ["courant", "vague"], difficulty: 7 },
  { word1: "glaçon", word2: "soleil", clue: "Action de passer de l'état solide à liquide", expectedType: "verbe", exactMatch: ["fondre"], distractors: ["évaporer", "chauffer"], difficulty: 7 },
  { word1: "secret", word2: "voix", clue: "Action de parler très bas", expectedType: "verbe", exactMatch: ["chuchoter"], distractors: ["crier", "avouer"], difficulty: 7 },
  { word1: "silence", word2: "montagne", clue: "Répétition d'un son réfléchi", expectedType: "nom", exactMatch: ["écho"], distractors: ["bruit", "vent"], difficulty: 7 },
  { word1: "diamant", word2: "verre", clue: "Action de marquer avec une pointe dure", expectedType: "verbe", exactMatch: ["rayer"], distractors: ["casser", "polir"], difficulty: 7 },
  { word1: "secret", word2: "cadenas", clue: "Qualité de ce qui ne peut être franchi", expectedType: "adjectif", exactMatch: ["inviolable"], distractors: ["solide", "invisible"], difficulty: 8 },
  { word1: "vapeur", word2: "moteur", clue: "Source d'action produisant un mouvement", expectedType: "nom", exactMatch: ["énergie"], distractors: ["puissance", "chaleur"], difficulty: 8 }
];

async function seedDatabase() {
  try {
    console.log("Connexion à MongoDB...");
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 20000 });
    console.log("Connecté à MongoDB.");
    
    await WordPair.deleteMany({});
    console.log("Anciennes énigmes nettoyées.");
    
    await WordPair.insertMany(logicalWordPairs);
    console.log(`${logicalWordPairs.length} énigmes ultra-logiques insérées avec succès !`);
    
    process.exit(0);
  } catch (err) {
    console.error("Erreur de seed:", err.message);
    process.exit(1);
  }
}

seedDatabase();