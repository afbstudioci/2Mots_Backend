const gameService = require('../services/gameService');

exports.getGameBatch = async (req, res) => {
    try {
        const batch = await gameService.fetchGameBatch();
        res.status(200).json({ status: 'success', data: batch });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la recuperation des mots' });
    }
};

exports.submitAnswer = async (req, res) => {
    try {
        const { wordPairId, userAnswer, timeRemaining } = req.body;
        const result = await gameService.validateAnswer(wordPairId, userAnswer, timeRemaining);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        const statusCode = error.message.includes('introuvable') ? 404 : 500;
        res.status(statusCode).json({ status: 'fail', message: error.message });
    }
};

exports.updateBestScore = async (req, res) => {
    try {
        const { score } = req.body;
        const result = await gameService.updateBestScore(req.user.id, score);
        const message = result.isNewRecord ? 'Nouveau record etabli' : 'Score enregistre';
        res.status(200).json({ status: 'success', message, data: { bestScore: result.bestScore } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};