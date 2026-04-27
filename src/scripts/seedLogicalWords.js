//src/scripts/seedLogicalWords.js
const mongoose = require('mongoose');
const WordPair = require('../models/WordPair');
require('dotenv').config();

const logicalPairs = [
    // --- Niveau 1-3 : Logique évidente ---
    { word1: 'Soleil', word2: 'Lune', clue: 'Astres opposés', expectedType: 'association', exactMatch: ['astronomie', 'ciel'], difficulty: 2, category: 'opposites' },
    { word1: 'Couteau', word2: 'Fourchette', clue: 'Ustensiles de table', expectedType: 'ensemble', exactMatch: ['couverts'], difficulty: 1, category: 'contextual' },
    { word1: 'Main', word2: 'Pied', clue: 'Extrémités du corps', expectedType: 'corps', exactMatch: ['membres'], difficulty: 2, category: 'general' },
    { word1: 'Chaud', word2: 'Froid', clue: 'Températures extrêmes', expectedType: 'climat', exactMatch: ['meteo', 'thermique'], difficulty: 1, category: 'opposites' },
    
    // --- Niveau 4-7 : Logique d'association ---
    { word1: 'Ciel', word2: 'Mer', clue: 'Partagent la même couleur', expectedType: 'couleur', exactMatch: ['bleu'], difficulty: 4, category: 'contextual' },
    { word1: 'Arbre', word2: 'Livre', clue: 'L\'un devient l\'autre', expectedType: 'matière', exactMatch: ['papier', 'bois'], difficulty: 5, category: 'contextual' },
    { word1: 'Clavier', word2: 'Souris', clue: 'Indispensables PC', expectedType: 'objet', exactMatch: ['ordinateur', 'informatique'], difficulty: 4, category: 'general' },
    { word1: 'Paris', word2: 'Londres', clue: 'Villes séparées par la Manche', expectedType: 'géographie', exactMatch: ['europe', 'capitales'], difficulty: 6, category: 'general' },
    { word1: 'Pluie', word2: 'Soleil', clue: 'Forme un phénomène coloré', expectedType: 'nature', exactMatch: ['arc-en-ciel'], difficulty: 5, category: 'contextual' },

    // --- Niveau 8-10 : Logique complexe / Idiomatique ---
    { word1: 'Aiguille', word2: 'Botte de foin', clue: 'Expression : Quelque chose d\'impossible à trouver', expectedType: 'expression', exactMatch: ['perdu', 'recherche'], difficulty: 8, category: 'idiomatic' },
    { word1: 'Coeur', word2: 'Pierre', clue: 'Expression : Quelqu\'un d\'insensible', expectedType: 'expression', exactMatch: ['froid', 'insensible'], difficulty: 9, category: 'idiomatic' },
    { word1: 'Silence', word2: 'Or', clue: 'L\'un est d\'argent, l\'autre est...', expectedType: 'proverbe', exactMatch: ['parole', 'proverbe'], difficulty: 8, category: 'idiomatic' },
    { word1: 'Echec', word2: 'Mat', clue: 'Fin de partie royale', expectedType: 'jeu', exactMatch: ['echecs', 'roi'], difficulty: 7, category: 'general' }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connecté à MongoDB...');
        
        await WordPair.deleteMany({ category: { $ne: 'legacy' } }); // On nettoie les anciens (sauf legacy)
        console.log('Anciennes énigmes nettoyées.');
        
        await WordPair.insertMany(logicalPairs);
        console.log('Nouvelles énigmes logiques insérées !');
        
        process.exit();
    } catch (error) {
        console.error('Erreur de seeding:', error);
        process.exit(1);
    }
};

seedDB();
