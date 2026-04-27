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

        const maxDifficulty = Math.min(10, user.level);
        const minDifficulty = Math.max(1, maxDifficulty - 2);

        // Projet allégé : Plus d'icônes envoyées au front !
        let words = await WordPair.aggregate([
            { 
                $match: { 
                    _id: { $nin: excludedWordIds }, 
                    isActive: true,
                    difficulty: { $gte: minDifficulty, $lte: maxDifficulty }
                } 
            },
            { $sample: { size: 10 } },
            { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1, difficulty: 1 } } 
        ]);

        if (words.length < 10) {
            words = await WordPair.aggregate([
                { 
                    $match: { 
                        _id: { $nin: excludedWordIds }, 
                        isActive: true,
                        difficulty: { $lte: maxDifficulty }
                    } 
                },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1, difficulty: 1 } }
            ]);
        }
        
        if (words.length < 10) {
            words = await WordPair.aggregate([
                { $match: { isActive: true } },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1, difficulty: 1 } }
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