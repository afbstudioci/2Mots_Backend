//src/controllers/missionController.js
const missionService = require('../services/missionService');

exports.getMissions = async (req, res) => {
    try {
        const missions = await missionService.getUserMissions(req.user.id);
        res.status(200).json({ status: 'success', data: missions });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.claimReward = async (req, res) => {
    try {
        const result = await missionService.claimMissionReward(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: "Récompense réclamée", data: result });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};
