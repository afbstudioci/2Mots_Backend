//src/services/missionService.js
const Mission = require('../models/Mission');
const UserMission = require('../models/UserMission');
const User = require('../models/User');

/**
 * Récupère les missions d'un utilisateur, en génère si besoin pour la journée
 */
exports.getUserMissions = async (userId) => {
    // 1. S'assurer que l'utilisateur a des missions pour aujourd'hui
    await this.ensureUserMissions(userId);

    // 2. Récupérer les missions actives pour l'utilisateur
    // On considère comme "récentes" les missions créées ou mises à jour aujourd'hui
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const userMissions = await UserMission.find({ 
        user: userId,
        createdAt: { $gte: startOfDay }
    }).populate('mission');
    
    return userMissions.map(um => ({
        id: um.mission._id,
        userMissionId: um._id,
        title: um.mission.title,
        desc: um.mission.desc,
        reward: um.mission.reward,
        type: um.mission.type,
        targetValue: um.mission.targetValue,
        progress: um.progress,
        completed: um.completed,
        claimed: um.claimed
    }));
};

/**
 * Assure qu'un utilisateur a 3 missions pour la journée
 */
exports.ensureUserMissions = async (userId) => {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const count = await UserMission.countDocuments({ 
        user: userId, 
        createdAt: { $gte: startOfDay } 
    });

    if (count === 0) {
        // Sélectionner 3 missions aléatoires dans le pool global
        const missionsPool = await Mission.find({ isActive: true });
        if (missionsPool.length === 0) return;

        // Mélanger et prendre 3
        const shuffled = missionsPool.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        const newUserMissions = selected.map(m => ({
            user: userId,
            mission: m._id,
            progress: 0,
            completed: false,
            claimed: false
        }));

        await UserMission.insertMany(newUserMissions);
    }
};

/**
 * Met à jour la progression d'une mission d'un certain type
 */
exports.updateMissionProgress = async (userId, targetType, increment = 1) => {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const userMissions = await UserMission.find({ 
        user: userId, 
        completed: false,
        createdAt: { $gte: startOfDay } 
    }).populate('mission');

    for (const um of userMissions) {
        if (um.mission.targetType === targetType) {
            um.progress += increment;
            if (um.progress >= um.mission.targetValue) {
                um.progress = um.mission.targetValue;
                um.completed = true;
            }
            await um.save();
        }
    }
};

/**
 * Réclame la récompense
 */
exports.claimMissionReward = async (userId, missionId) => {
    const userMission = await UserMission.findOne({ 
        user: userId, 
        mission: missionId,
        completed: true,
        claimed: false
    }).populate('mission');

    if (!userMission) {
        throw new Error("Mission non complétée ou déjà réclamée");
    }

    userMission.claimed = true;
    await userMission.save();

    const user = await User.findById(userId);
    user.kevs += userMission.mission.reward;
    await user.save();

    return { newKevs: user.kevs };
};
