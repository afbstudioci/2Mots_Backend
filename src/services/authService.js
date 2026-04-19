//src/services/authService.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn, adminMail } = require('../config/env');

const generateTokens = (userId) => {
    if (!jwtSecret || !jwtRefreshSecret) {
        throw new Error('Erreur de configuration serveur : Clés JWT manquantes');
    }

    const accessToken = jwt.sign({ id: userId }, jwtSecret, {
        expiresIn: jwtExpiresIn
    });

    const refreshToken = jwt.sign({ id: userId }, jwtRefreshSecret, {
        expiresIn: jwtRefreshExpiresIn
    });

    return { accessToken, refreshToken };
};

exports.registerUser = async (login, email, password) => {
    const existingUser = await User.findOne({ $or: [{ email }, { login }] });
    if (existingUser) {
        throw new Error('Un utilisateur avec cet email ou ce pseudo existe déjà');
    }

    let assignedRole = 'user';
    if (adminMail && email.toLowerCase() === adminMail.toLowerCase()) {
        assignedRole = 'superadmin';
    }

    const newUser = await User.create({
        login,
        email,
        password,
        role: assignedRole
    });

    const { accessToken, refreshToken } = generateTokens(newUser._id);
    
    newUser.refreshTokens.push(refreshToken);
    await newUser.save({ validateBeforeSave: false });

    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.loginUser = async (loginIdentifier, password) => {
    const user = await User.findOne({
        $or: [{ email: loginIdentifier }, { login: loginIdentifier }]
    }).select('+password');

    if (!user || !(await user.comparePassword(password, user.password))) {
        throw new Error('Identifiants incorrects');
    }

    if (adminMail && user.email.toLowerCase() === adminMail.toLowerCase() && user.role !== 'superadmin') {
        user.role = 'superadmin';
        await user.save({ validateBeforeSave: false });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.refreshUserToken = async (currentRefreshToken) => {
    try {
        if (!jwtRefreshSecret) throw new Error('Configuration serveur invalide');

        const decoded = jwt.verify(currentRefreshToken, jwtRefreshSecret);
        
        const user = await User.findById(decoded.id);
        if (!user || !user.refreshTokens.includes(currentRefreshToken)) {
            throw new Error('Jeton de rafraîchissement invalide ou expiré');
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        user.refreshTokens = user.refreshTokens.filter(token => token !== currentRefreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
        throw new Error('Session expirée, veuillez vous reconnecter');
    }
};

exports.logoutUser = async (userId) => {
    const user = await User.findById(userId);
    if (user) {
        user.refreshTokens = [];
        await user.save({ validateBeforeSave: false });
    }
};

exports.getUserProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return userResponse;
};

exports.requestPasswordReset = async (email) => {
    return null;
};