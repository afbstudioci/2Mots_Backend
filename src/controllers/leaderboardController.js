//src/controllers/leaderboardController.js
const User = require('../models/User');

exports.getGlobalLeaderboard = async (req, res) => {
    try {
        // On sélectionne uniquement ce qui existe dans ton modèle User.js
        const leaders = await User.find({ isBanned: false })
            .select('login bestScore xp level')
            .sort({ bestScore: -1 })
            .limit(10);

        res.status(200).json({
            status: 'success',
            data: leaders
        });
    } catch (error) {
        // Correction des accents dans le message d'erreur
        res.status(500).json({ 
            status: 'error', 
            message: 'Erreur lors de la récupération du classement' 
        });
    }
};