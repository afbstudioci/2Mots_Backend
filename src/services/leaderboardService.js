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

/**
 * Recupere les vrais rangs et rivaux du classement mondial depuis MongoDB pour les alertes en direct
 */
exports.fetchNearbyRivals = async (userId, userBestScore = 0) => {
    try {
        const allUsers = await User.find({ isBanned: false })
            .select('_id login bestScore level xp avatar')
            .sort({ level: -1, xp: -1, bestScore: -1 })
            .limit(100);

        if (!allUsers || allUsers.length === 0) return { userRank: 1, rivals: [] };

        const userIndex = allUsers.findIndex(u => String(u._id) === String(userId));
        const currentUserRank = userIndex !== -1 ? userIndex + 1 : allUsers.length + 1;

        const rivals = allUsers
            .filter(u => String(u._id) !== String(userId))
            .map((u) => ({
                pseudo: u.login || 'Joueur',
                score: u.bestScore || 0,
                level: u.level || 1,
                rank: allUsers.findIndex(x => String(x._id) === String(u._id)) + 1
            }));

        return {
            userRank: currentUserRank,
            rivals
        };
    } catch (err) {
        console.error('[LEADERBOARD] Erreur calcul rangs réels:', err.message);
        return { userRank: 1, rivals: [] };
    }
};