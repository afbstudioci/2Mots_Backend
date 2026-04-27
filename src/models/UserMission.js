const mongoose = require('mongoose');

const userMissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mission',
        required: true
    },
    progress: {
        type: Number,
        default: 0
    },
    completed: {
        type: Boolean,
        default: false
    },
    claimed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Index pour éviter les doublons de missions pour un même utilisateur
userMissionSchema.index({ user: 1, mission: 1 }, { unique: true });

const UserMission = mongoose.model('UserMission', userMissionSchema);
module.exports = UserMission;
