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
 * Calcule les vrais rivaux devant et le poursuivant direct derriere pour le Classement Mondial
 */
exports.fetchNearbyRivals = async (userId, userBestScore = 0) => {
    try {
        const allUsers = await User.find({ isBanned: false })
            .select('_id login level xp bestScore avatar')
            .sort({ level: -1, xp: -1, bestScore: -1 })
            .limit(100);

        if (!allUsers || allUsers.length === 0) {
            return { userRank: 1, rivals: [], threatBehind: null };
        }

        const userIdx = allUsers.findIndex(u => String(u._id) === String(userId));
        const currentUser = userIdx !== -1 ? allUsers[userIdx] : null;
        const currentRank = userIdx !== -1 ? userIdx + 1 : allUsers.length + 1;

        if (!currentUser) {
            return { userRank: currentRank, rivals: [], threatBehind: null };
        }

        // 1. Joueur réel situé DIRECTEMENT DERRIÈRE l'utilisateur au classement
        let threatBehind = null;
        if (userIdx !== -1 && userIdx + 1 < allUsers.length) {
            const playerBehind = allUsers[userIdx + 1];
            threatBehind = {
                pseudo: playerBehind.login || 'Joueur',
                rank: userIdx + 2,
                level: playerBehind.level || 1
            };
        }

        if (userIdx <= 0) {
            return { userRank: 1, rivals: [], threatBehind };
        }

        // 2. Récupérer les 3 joueurs réels directement DEVANT l'utilisateur au classement
        const playersAhead = allUsers.slice(Math.max(0, userIdx - 3), userIdx).reverse();

        const rivals = playersAhead.map((player, idx) => {
            const targetRank = userIdx - idx;

            let xpDiff = 0;
            if (player.level === currentUser.level) {
                xpDiff = Math.max(1, (player.xp || 0) - (currentUser.xp || 0) + 1);
            } else {
                const levelGap = Math.max(1, player.level - currentUser.level);
                xpDiff = Math.max(1, levelGap * 20 + ((player.xp || 0) - (currentUser.xp || 0)) + 1);
            }

            return {
                pseudo: player.login || 'Joueur',
                rank: targetRank,
                score: xpDiff,
                level: player.level
            };
        });

        rivals.sort((a, b) => a.score - b.score);

        return {
            userRank: currentRank,
            rivals,
            threatBehind
        };
    } catch (err) {
        console.error('[LEADERBOARD] Erreur calcul rivaux réels:', err.message);
        return { userRank: 1, rivals: [], threatBehind: null };
    }
};