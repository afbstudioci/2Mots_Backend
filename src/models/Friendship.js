const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        default: 'pending'
    },
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Empêcher d'avoir plusieurs relations entre les deux mêmes personnes
friendshipSchema.index({ users: 1 });

const Friendship = mongoose.model('Friendship', friendshipSchema);
module.exports = Friendship;
