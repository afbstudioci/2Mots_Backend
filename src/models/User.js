//src/models/User.js
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
    playedWords: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WordPair'
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
    refreshTokens: [{ type: String }]
}, { timestamps: true });

userSchema.index({ playedWords: 1 });

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;