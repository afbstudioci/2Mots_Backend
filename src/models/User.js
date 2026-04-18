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
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshTokens: [{ type: String }]
}, { timestamps: true });

// Middleware pour hasher le mot de passe avant la sauvegarde (Refactorisé Mongoose 9+)
userSchema.pre('save', async function() {
    // Si le mot de passe n'est pas modifié, on sort de la fonction simplement
    if (!this.isModified('password')) return;
    
    // Le hashage se fait de manière asynchrone, sans avoir besoin d'appeler next()
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Methode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;