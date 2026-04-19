//src/controllers/leaderboardController.js
const leaderboardService = require('../services/leaderboardService');

exports.getTopPlayers = async (req, res) => {
    try {
        const leaders = await leaderboardService.fetchGlobalTopPlayers(10);

        res.status(200).json({
            status: 'success',
            data: leaders
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Erreur lors de la récupération du classement' 
        });
    }
};