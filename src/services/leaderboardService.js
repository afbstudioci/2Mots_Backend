//src/services/leaderboardService.js
const User = require('../models/User');

/**
 * Récupère les meilleurs joueurs pour le Top 3 + Top 10 de la liste
 * @param {number} limit - On passe à 13 pour avoir un compte rond dans la liste
 */
exports.fetchGlobalTopPlayers = async (limit = 13) => {
    return await User.find({ isBanned: false })
        .select('login bestScore xp level')
        .sort({ bestScore: -1 })
        .limit(limit);
};