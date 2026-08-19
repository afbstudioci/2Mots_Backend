//src/services/leaderboardService.js
const User = require('../models/User');

/**
 * Recupere les meilleurs joueurs du classement mondial
 */
exports.fetchGlobalTopPlayers = async (limit = 15) => {
    return await User.find({ isBanned: false })
        .select('login bestScore xp level avatar')
        .sort({ bestScore: -1, level: -1, xp: -1 })
        .limit(limit);
};