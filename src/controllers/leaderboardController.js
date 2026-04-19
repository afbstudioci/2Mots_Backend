//src/controllers/leaderboardController.js
const User = require('../models/User');

exports.getTopPlayers = async (req, res) => {
    try {
        // Optimisation : On ne récupère que les champs stricts nécessaires pour l'affichage
        const topPlayers = await User.find({ isBanned: false })
            .select('login bestScore level')
            .sort({ bestScore: -1 })
            .limit(10);

        res.status(200).json({
            status: 'success',
            data: {
                leaderboard: topPlayers
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la récupération du classement' });
    }
};