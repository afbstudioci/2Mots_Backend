//src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    login: {
        type: String,
        required: [true, "Le pseudo est obligatoire."],
        unique: true,
        trim: true,
        minlength: [3, "Le pseudo doit contenir au moins 3 caractères."],
        maxlength: [20, "Le pseudo ne peut pas dépasser 20 caractères."]
    },
    email: {
        type: String,
        required: [true, "L'adresse email est obligatoire."],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, "Le mot de passe est obligatoire."],
        minlength: [8, "Le mot de passe doit contenir au moins 8 caractères."],
        select: false
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    bestScore: {
        type: Number,
        default: 0
    },
    kevs: {
        type: Number,
        default: 100
    },
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    kevyKeys: {
        type: Number,
        default: 0,
        min: 0
    },
    playedWords: [{
        word: {
            type: String,
            required: true
        },
        cooldownUntil: {
            type: Date,
            default: null
        }
    }],
    isBanned: {
        type: Boolean,
        default: false
    },
    banReason: {
        type: String,
        default: null
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshTokens: [{ type: String }],
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referralRewardClaimed: {
        type: Boolean,
        default: false
    },
    fcmToken: {
        type: String,
        default: null
    },
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isVip: {
        type: Boolean,
        default: false
    },
    vipExpiresAt: {
        type: Date,
        default: null
    },
    streakFreezes: {
        type: Number,
        default: 1
    },
    inventory: {
        boosters: {
            timeFreeze: { type: Number, default: 2 },
            superClue: { type: Number, default: 2 },
            secondChance: { type: Number, default: 1 }
        },
        themes: [{ type: String }],
        avatarFrames: [{ type: String }]
    },
    equippedFrame: {
        type: String,
        default: null
    },
    equippedTheme: {
        type: String,
        default: null
    },
    chatSettings: [{
        friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isMuted: { type: Boolean, default: false },
        theme: { type: String, default: 'default' }
    }]
}, { timestamps: true });

userSchema.index({ 'playedWords.word': 1, 'playedWords.cooldownUntil': 1 });

userSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }

    if (!this.referralCode) {
        this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
});

userSchema.methods.comparePassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;