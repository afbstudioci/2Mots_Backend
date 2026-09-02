//src/services/authService.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';
const adminMail = process.env.ADMIN_MAIL || 'admin@2mots.fr';

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
};

const calculateUserRank = async (user) => {
    const hasPlayed = (user.bestScore || 0) > 0 || (user.xp || 0) > 0 || (user.level || 1) > 1;
    if (!hasPlayed) return null;

    const userLevel = user.level || 1;
    const userXp = user.xp || 0;
    const userBestScore = user.bestScore || 0;

    const countBetter = await User.countDocuments({
        isBanned: false,
        $or: [
            { level: { $gt: userLevel } },
            { level: userLevel, xp: { $gt: userXp } },
            { level: userLevel, xp: userXp, bestScore: { $gt: userBestScore } }
        ]
    });

    return countBetter + 1;
};

exports.registerUser = async (login, email, password, referredByCode = null) => {
    if (!login || typeof login !== 'string' || login.trim().length === 0) {
        throw new Error('Le pseudo est obligatoire.');
    }
    const normalizedLogin = login.trim();
    if (normalizedLogin.length < 3) {
        throw new Error('Le pseudo doit contenir au moins 3 caractères.');
    }
    if (normalizedLogin.length > 20) {
        throw new Error('Le pseudo ne peut pas dépasser 20 caractères.');
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
        throw new Error("L'adresse email est obligatoire.");
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        throw new Error('Veuillez fournir une adresse email valide.');
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    }

    const escaped = normalizedLogin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUser = await User.findOne({
        $or: [
            { email: normalizedEmail },
            { login: { $regex: new RegExp(`^${escaped}$`, 'i') } }
        ]
    }).lean();

    if (existingUser) {
        if (existingUser.email && existingUser.email.toLowerCase() === normalizedEmail) {
            throw new Error('Cette adresse email est déjà utilisée.');
        }
        throw new Error('Ce pseudo est déjà pris.');
    }

    let referredByUser = null;
    if (referredByCode && typeof referredByCode === 'string' && referredByCode.trim().length > 0) {
        referredByUser = await User.findOne({ referralCode: referredByCode.trim().toUpperCase() });
        if (!referredByUser) {
            throw new Error('Code de parrainage invalide.');
        }
    }

    let assignedRole = 'user';
    if (adminMail && normalizedEmail === adminMail.toLowerCase()) {
        assignedRole = 'superadmin';
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedLogin)}&background=FF5A5F&color=fff&size=128`;
    
    // 100 Kevs offerts par défaut à l'inscription + 200 Kevs bonus si parrainé
    const initialKevs = referredByUser ? 300 : 100;

    const mongoose = require('mongoose');
    const newUserId = new mongoose.Types.ObjectId();
    const { accessToken, refreshToken } = generateTokens(newUserId);

    const newUser = await User.create({
        _id: newUserId,
        login: normalizedLogin,
        email: normalizedEmail,
        password,
        avatar: defaultAvatar,
        role: assignedRole,
        kevs: initialKevs,
        referredBy: referredByUser ? referredByUser._id : null,
        refreshTokens: [refreshToken]
    });

    if (referredByUser) {
        referredByUser.kevs = (referredByUser.kevs || 0) + 500;
        await referredByUser.save();
    }

    const userResponse = newUser.toObject();
    try {
        userResponse.rank = await calculateUserRank(newUser);
    } catch {
        userResponse.rank = null;
    }
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.loginUser = async (identifier, password) => {
    if (!identifier || !password) {
        throw new Error('Identifiant et mot de passe requis');
    }

    const normalizedIdentifier = identifier.trim();
    const isEmail = normalizedIdentifier.includes('@');

    let query;
    if (isEmail) {
        query = { email: normalizedIdentifier.toLowerCase() };
    } else {
        const escaped = normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query = {
            $or: [
                { login: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                { email: normalizedIdentifier.toLowerCase() }
            ]
        };
    }

    const user = await User.findOne(query).select('+password');

    if (!user) {
        throw new Error('Identifiants invalides');
    }

    if (user.isBanned) {
        throw new Error(user.banReason ? `Compte suspendu : ${user.banReason}` : 'Votre compte a été suspendu.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Identifiants invalides');
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    if (!Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
    }
    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 20) {
        user.refreshTokens = user.refreshTokens.slice(-20);
    }
    await user.save({ validateBeforeSave: false });

    const userResponse = user.toObject();
    try {
        userResponse.rank = await calculateUserRank(user);
    } catch {
        userResponse.rank = null;
    }
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) throw new Error('Refresh token manquant');

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new Error('Token invalide ou expiré');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken: newRefreshToken };
};

exports.refreshUserToken = exports.refreshAccessToken;

exports.logoutUser = async (userId) => {
    if (!userId) return;
    await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
};

exports.getUserProfile = async (userId) => {
    const user = await User.findById(userId).lean();
    if (!user) {
        throw new Error('Utilisateur non trouvé');
    }
    const rank = await calculateUserRank(user);
    delete user.password;
    delete user.refreshTokens;
    return { ...user, rank };
};

exports.updateUserProfile = async (userId, { login, email, currentPassword, newPassword, avatarUrl }) => {
    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new Error('Utilisateur non trouvé');
    }

    if (login && login.trim() !== user.login) {
        const existingLogin = await User.findOne({ login: login.trim(), _id: { $ne: userId } });
        if (existingLogin) throw new Error('Ce pseudo est déjà pris');
        user.login = login.trim();
    }

    if (email && email.trim().toLowerCase() !== user.email) {
        const existingEmail = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: userId } });
        if (existingEmail) throw new Error('Cet email est déjà utilisé');
        user.email = email.trim().toLowerCase();
    }

    if (newPassword) {
        if (!currentPassword) {
            throw new Error('Le mot de passe actuel est requis pour modifier le mot de passe');
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new Error('Mot de passe actuel incorrect');
        }
        user.password = newPassword;
    }

    if (avatarUrl) {
        user.avatar = avatarUrl;
    }

    await user.save();

    const userObj = user.toObject();
    userObj.rank = await calculateUserRank(user);
    delete userObj.password;
    delete userObj.refreshTokens;
    return userObj;
};

exports.requestPasswordReset = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return null;

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });
    return resetToken;
};

exports.loginWithGoogle = async ({ email, name, profilePicture, mode }) => {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        if (mode === 'login_only') {
            throw new Error("Aucun compte n'est associé à cet email Google. Veuillez d'abord vous inscrire.");
        }
        const baseLogin = (name || normalizedEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15) || 'user';
        let uniqueLogin = baseLogin;
        let suffix = 1;
        while (await User.findOne({ login: uniqueLogin })) {
            uniqueLogin = `${baseLogin}${suffix}`;
            suffix++;
        }

        const crypto = require('crypto');
        const randomPassword = crypto.randomBytes(24).toString('hex');

        user = await User.create({
            login: uniqueLogin,
            email: normalizedEmail,
            password: randomPassword,
            avatar: profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(uniqueLogin)}&background=FF5A5F&color=fff&size=128`,
            kevs: 100
        });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    const userResponse = user.toObject();
    userResponse.rank = await calculateUserRank(user);
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};