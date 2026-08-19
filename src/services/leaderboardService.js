//src/services/leaderboardService.js
const User = require('../models/User');

/**
 * Recupere les meilleurs joueurs du classement mondial bases sur le Niveau puis XP puis Record
 */
exports.fetchGlobalTopPlayers = async (limit = 20) => {
    return await User.find({ isBanned: false })
        .select('login bestScore xp level avatar')
        .sort({ level: -1, xp: -1, bestScore: -1 })
        .limit(limit);
};