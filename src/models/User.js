const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    login: { 
        type: String, 
        required: [true, 'Le pseudo est obligatoire'], 
        unique: true,
        trim: true,
        minlength: [3, 'Le pseudo doit contenir au moins 3 caracteres']
    },
    email: { 
        type: String, 
        required: [true, 'L\'email est obligatoire'], 
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: [true, 'Le mot de passe est obligatoire'],
        minlength: [8, 'Le mot de passe doit contenir au moins 8 caracteres'],
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
        default: 0
    },
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    // NOUVEAU : Tableau d'objets avec Date de cooldown
    playedWords: [{
        word: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'WordPair'
        },
        cooldownUntil: {
            type: Date,
            default: null // Null signifie vu, mais plus en cooldown
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
    fcmToken: {
        type: String,
        default: null
    }
}, { timestamps: true });

// Index composé pour optimiser la recherche des mots en cooldown
userSchema.index({ 'playedWords.word': 1, 'playedWords.cooldownUntil': 1 });

userSchema.pre('save', async function(next) {
    // 1. Hash password
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // 2. Generate referral code
    if (!this.referralCode) {
        this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    next();
});

userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;