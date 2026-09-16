// src/models/SystemSetting.js
// MODELE DE CONFIGURATION ET PARAMETRES SYSTEME - 2MOTS
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

module.exports = SystemSetting;
