const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    desc: {
        type: String,
        required: true
    },
    reward: {
        type: Number,
        required: true,
        default: 10
    },
    type: {
        type: String,
        enum: ['daily', 'weekly', 'achievement'],
        default: 'daily'
    },
    targetType: {
        type: String,
        enum: ['words_solved', 'levels_reached', 'kevs_spent', 'friends_added'],
        required: true
    },
    targetValue: {
        type: Number,
        required: true
    },
    targetAction: {
        type: String,
        default: 'Home' // Route par défaut
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Mission = mongoose.model('Mission', missionSchema);
module.exports = Mission;
