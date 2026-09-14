// src/controllers/adRewardController.js
// CONTROLEUR DE GESTION DES RECOMPENSES PUBLICITAIRES ADMOB
// Standard : Bank Grade / Clean Architecture (Strict <= 270 lignes, Sans Emojis)

const adRewardService = require('../services/adRewardService');

exports.getShopStatus = async (req, res, next) => {
  try {
    const status = await adRewardService.getShopAdStatus(req.user._id);
    res.status(200).json({ status: 'success', data: status });
  } catch (error) {
    next(error);
  }
};

exports.claimShop = async (req, res, next) => {
  try {
    const result = await adRewardService.claimShopReward(req.user._id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.claimSecondChance = async (req, res, next) => {
  try {
    const result = await adRewardService.claimSecondChance(req.user._id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.claimDoubleKevs = async (req, res, next) => {
  try {
    const { sessionKevs } = req.body;
    const result = await adRewardService.claimDoubleKevs(req.user._id, sessionKevs);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.claimEmergencyBooster = async (req, res, next) => {
  try {
    const { boosterType } = req.body;
    const result = await adRewardService.claimEmergencyBooster(req.user._id, boosterType);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};
