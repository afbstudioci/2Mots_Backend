const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['info', 'warn', 'error', 'security'],
        default: 'info'
    },
    message: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    metadata: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '7d' } // Auto-suppression après 7 jours
    }
});

const SystemLog = mongoose.model('SystemLog', systemLogSchema);
module.exports = SystemLog;
