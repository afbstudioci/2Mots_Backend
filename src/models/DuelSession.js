//src/models/DuelSession.js
const mongoose = require('mongoose');

const duelSessionSchema = new mongoose.Schema({
    challenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Le challenger est obligatoire.'],
        index: true
    },
    opponent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'L\'adversaire est obligatoire.'],
        index: true
    },
    betAmount: {
        type: Number,
        required: [true, 'La mise est obligatoire.'],
        min: [10, 'La mise minimale est de 10 Kevs.'],
        default: 25
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'ready', 'waiting_players', 'in_progress', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    scores: {
        challenger: { type: Number, default: 0 },
        opponent: { type: Number, default: 0 }
    },
    enigmas: [{
        enigmaId: { type: String, required: true },
        word1: { type: String, required: true },
        word2: { type: String, required: true },
        answer: { type: String, required: true },
        propositions: [{ type: String, required: true }],
        clue: { type: String, default: '' }
    }],
    currentEnigmaIndex: {
        type: Number,
        default: 0
    },
    activeBuzzer: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        lockedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null }
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isDraw: {
        type: Boolean,
        default: false
    },
    totalPot: {
        type: Number,
        default: 0
    },
    duration: {
        type: Number,
        default: 60
    },
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true, versionKey: false });

duelSessionSchema.index({ status: 1, createdAt: -1 });
duelSessionSchema.index({ challenger: 1, opponent: 1, status: 1 });

const DuelSession = mongoose.model('DuelSession', duelSessionSchema);
module.exports = DuelSession;
