//src/controllers/gameController.js
const WordPair = require('../models/WordPair');
const User = require('../models/User');
const gameService = require('../services/gameService');

exports.getBatch = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.isBanned) {
            return res.status(403).json({ status: 'error', message: 'Compte suspendu.' });
        }

        const now = new Date();
        const excludedWordIds = user.playedWords
            .filter(pw => pw.cooldownUntil && pw.cooldownUntil > now)
            .map(pw => pw.word);

        // Calcul de la difficulté ciblée
        // Niveau 1-3 : Facile, 4-6 : Moyen, 7-10 : Difficile
        const targetDifficulty = Math.min(10, user.level);
        const minDiff = Math.max(1, targetDifficulty - 1);
        const maxDiff = Math.min(10, targetDifficulty + 1);

        // Sélection intelligente : on cherche à varier les catégories
        let words = await WordPair.aggregate([
            { 
                $match: { 
                    _id: { $nin: excludedWordIds }, 
                    isActive: true,
                    difficulty: { $gte: minDiff, $lte: maxDiff }
                } 
            },
            { $sample: { size: 12 } }, // On en prend un peu plus pour filtrer
            { $limit: 10 },
            { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1, difficulty: 1, category: 1 } } 
        ]);

        // Fallback si pas assez de mots dans la tranche
        if (words.length < 10) {
            words = await WordPair.aggregate([
                { 
                    $match: { 
                        _id: { $nin: excludedWordIds }, 
                        isActive: true,
                        difficulty: { $lte: maxDiff }
                    } 
                },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1, difficulty: 1, category: 1 } }
            ]);
        }
        
        res.status(200).json({ status: 'success', data: words });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.checkAnswer = async (req, res) => {
    try {
        const { wordPairId, answer, timeSpent } = req.body;
        const userId = req.user.id;

        if (!wordPairId || answer === undefined || timeSpent === undefined) {
            return res.status(400).json({ status: 'error', message: 'Données manquantes' });
        }

        const result = await gameService.checkAnswerRealtime(userId, wordPairId, answer, timeSpent);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.validateSession = async (req, res) => {
    try {
        const { answers } = req.body;
        const userId = req.user.id;
        const result = await gameService.validateFinalSession(userId, answers);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        if (error.message.includes('Tricherie')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: error.message });
    }
};