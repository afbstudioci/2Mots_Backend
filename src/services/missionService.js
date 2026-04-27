//src/services/missionService.js
const Mission = require('../models/Mission');
const UserMission = require('../models/UserMission');
const User = require('../models/User');

/**
 * Récupère les missions d'un utilisateur avec sa progression
 */
exports.getUserMissions = async (userId) => {
    // 1. Récupérer toutes les missions actives
    const missions = await Mission.find({ isActive: true });
    
    // 2. Récupérer la progression de l'utilisateur
    const userMissions = await UserMission.find({ user: userId });
    
    // 3. Fusionner les données
    return missions.map(m => {
        const progress = userMissions.find(um => um.mission.toString() === m._id.toString());
        return {
            id: m._id,
            title: m.title,
            desc: m.desc,
            reward: m.reward,
            type: m.type,
            targetValue: m.targetValue,
            progress: progress ? progress.progress : 0,
            completed: progress ? progress.completed : false,
            claimed: progress ? progress.claimed : false
        };
    });
};

/**
 * Réclame la récompense d'une mission terminée
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

    // 1. Marquer comme réclamée
    userMission.claimed = true;
    await userMission.save();

    // 2. Ajouter la récompense
    const user = await User.findById(userId);
    user.kevs += userMission.mission.reward;
    await user.save();

    return { newKevs: user.kevs };
};
