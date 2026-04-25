const WordPair = require('../models/WordPair');
const User = require('../models/User');
const gameService = require('../services/gameService');

exports.getBatch = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.isBanned) {
            return res.status(403).json({ status: 'error', message: 'Compte suspendu.' });
        }

        let words = await WordPair.aggregate([
            { $match: { _id: { $nin: user.playedWords }, isActive: true } },
            { $sample: { size: 10 } },
            { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } } 
        ]);

        if (words.length < 10) {
            const keepCount = Math.floor(user.playedWords.length * 0.2);
            user.playedWords = user.playedWords.slice(-keepCount);
            await user.save();

            words = await WordPair.aggregate([
                { $match: { _id: { $nin: user.playedWords }, isActive: true } },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } }
            ]);
        }

        if (words.length < 10) {
            words = await WordPair.aggregate([
                { $match: { isActive: true } },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } }
            ]);
        }

        res.status(200).json({ status: 'success', data: words });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Orchestrateur de la validation en temps réel
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

// Orchestrateur de la validation de fin de partie
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