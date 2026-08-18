//src/services/missionService.js
const Mission = require('../models/Mission');
const UserMission = require('../models/UserMission');
const User = require('../models/User');

const DEFAULT_MISSIONS = [
  { title: "Maitre des Mots", desc: "Trouvez 5 enigmes avec succes", reward: 5, targetValue: 5, targetType: "words_solved", isActive: true },
  { title: "Progression Constante", desc: "Montez de 1 niveau", reward: 10, targetValue: 1, targetType: "levels_reached", isActive: true },
  { title: "Reflexion Eclair", desc: "Trouvez 3 enigmes en moins de 5 secondes", reward: 8, targetValue: 3, targetType: "fast_answers", isActive: true },
  { title: "Champion Quotidien", desc: "Trouvez 10 enigmes", reward: 15, targetValue: 10, targetType: "words_solved", isActive: true }
];

const seedMissionsIfEmpty = async () => {
  try {
    const count = await Mission.countDocuments();
    if (count === 0) {
      await Mission.insertMany(DEFAULT_MISSIONS);
    }
  } catch (e) {}
};

exports.ensureUserMissions = async (userId) => {
  try {
    await seedMissionsIfEmpty();
    const existing = await UserMission.find({ user: userId });

    if (!existing || existing.length < 3) {
      const missionsPool = await Mission.find({ isActive: true });
      if (!missionsPool || missionsPool.length === 0) return;

      const shuffled = [...missionsPool].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);

      for (const m of selected) {
        await UserMission.findOneAndUpdate(
          { user: userId, mission: m._id },
          { $setOnInsert: { user: userId, mission: m._id, progress: 0, completed: false, claimed: false } },
          { upsert: true, new: true }
        );
      }
    }
  } catch (e) {
    console.warn('[MISSIONS] ensureUserMissions warn:', e.message);
  }
};

exports.getUserMissions = async (userId) => {
  try {
    await this.ensureUserMissions(userId);

    const userMissions = await UserMission.find({ user: userId }).populate('mission');
    return userMissions
      .filter((um) => um.mission)
      .map((um) => ({
        id: um.mission._id,
        userMissionId: um._id,
        title: um.mission.title,
        desc: um.mission.desc,
        reward: um.mission.reward,
        type: um.mission.targetType || um.mission.type,
        targetValue: um.mission.targetValue,
        progress: um.progress,
        completed: um.completed,
        claimed: um.claimed,
      }));
  } catch (e) {
    console.warn('[MISSIONS] getUserMissions warn:', e.message);
    return [];
  }
};

exports.updateMissionProgress = async (userId, targetType, increment = 1) => {
  try {
    const userMissions = await UserMission.find({ user: userId, completed: false }).populate('mission');
    for (const um of userMissions) {
      if (um.mission && (um.mission.targetType === targetType || um.mission.type === targetType)) {
        um.progress += increment;
        if (um.progress >= um.mission.targetValue) {
          um.progress = um.mission.targetValue;
          um.completed = true;
        }
        await um.save();
      }
    }
  } catch (e) {}
};

exports.claimMissionReward = async (userId, missionId) => {
  const updatedMission = await UserMission.findOneAndUpdate(
    { user: userId, mission: missionId, completed: true, claimed: false },
    { $set: { claimed: true } },
    { new: true }
  ).populate('mission');

  if (!updatedMission) {
    throw new Error('Mission non complétée, déjà réclamée ou inexistante');
  }

  const reward = (updatedMission.mission && updatedMission.mission.reward) || 5;
  const user = await User.findByIdAndUpdate(userId, { $inc: { kevs: reward } }, { new: true });
  return { newKevs: user?.kevs || 0 };
};