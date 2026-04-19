//src/services/leaderboardService.js
const User = require('../models/User');

/**
 * Récupère les meilleurs joueurs selon leur score record
 * @param {number} limit - Nombre maximum de joueurs à retourner
 * @returns {Promise<Array>} - Liste des joueurs
 */
exports.fetchGlobalTopPlayers = async (limit = 10) => {
    return await User.find({ isBanned: false })
        .select('login bestScore xp level')
        .sort({ bestScore: -1 })
        .limit(limit);
};