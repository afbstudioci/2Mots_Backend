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
 * Recupere les rivaux du classement mondial pour les alertes de depassement en direct
 */
exports.fetchNearbyRivals = async (userId, userBestScore = 0) => {
    try {
        const higherRivals = await User.find({
            _id: { $ne: userId },
            isBanned: false,
            bestScore: { $gt: Number(userBestScore) || 0 }
        })
        .select('login bestScore level avatar')
        .sort({ bestScore: 1 })
        .limit(6);

        if (higherRivals && higherRivals.length >= 3) {
            return higherRivals.map(r => ({
                pseudo: r.login || 'Joueur',
                score: r.bestScore || 1,
                level: r.level || 1
            }));
        }

        const topPlayers = await User.find({
            _id: { $ne: userId },
            isBanned: false,
            bestScore: { $gt: 0 }
        })
        .select('login bestScore level avatar')
        .sort({ bestScore: 1 })
        .limit(8);

        if (topPlayers && topPlayers.length > 0) {
            return topPlayers.map(r => ({
                pseudo: r.login || 'Joueur',
                score: r.bestScore || 1,
                level: r.level || 1
            }));
        }
    } catch {}

    return [
        { pseudo: 'Lucas', score: 5, level: 2 },
        { pseudo: 'Sarah', score: 8, level: 3 },
        { pseudo: 'Alexandre', score: 12, level: 4 },
        { pseudo: 'Marc', score: 18, level: 5 },
        { pseudo: 'Elena', score: 25, level: 6 }
    ];
};