const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    word: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true 
    },
    accuracy: { 
        type: Number, 
        required: true,
        enum: [100, 80, 50] // Seulement ces trois valeurs possibles selon le CD
    }
}, { _id: false });

const wordPairSchema = new mongoose.Schema({
    word1: { 
        type: String, 
        required: true, 
        trim: true 
    },
    word2: { 
        type: String, 
        required: true, 
        trim: true 
    },
    icon1: { 
        type: String, 
        required: true 
    },
    icon2: { 
        type: String, 
        required: true 
    },
    logicalHint: { 
        type: String, 
        required: true 
    },
    answers: [answerSchema]
}, {
    timestamps: true
});

// Index pour optimiser la recherche aléatoire de mots
wordPairSchema.index({ word1: 1, word2: 1 });

module.exports = mongoose.model('WordPair', wordPairSchema);