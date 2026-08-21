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
    const count = await User.countDocuments({ xp: { $gt: user.xp || 0 } });
    return count + 1;
};

exports.registerUser = async (login, email, password, referredByCode = null) => {
    const normalizedLogin = login.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { login: normalizedLogin }]
    });

    if (existingUser) {
        if (existingUser.email === normalizedEmail) throw new Error('Cet email est déjà utilisé');
        throw new Error('Ce pseudo est déjà pris');
    }

    let referredByUser = null;
    if (referredByCode && typeof referredByCode === 'string' && referredByCode.trim().length > 0) {
        referredByUser = await User.findOne({ referralCode: referredByCode.trim().toUpperCase() });
        if (!referredByUser) {
            throw new Error('Code de parrainage invalide');
        }
    }

    let assignedRole = 'user';
    if (adminMail && normalizedEmail === adminMail.toLowerCase()) {
        assignedRole = 'superadmin';
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedLogin)}&background=FF5A5F&color=fff&size=128`;
    
    // 100 Kevs offerts par défaut à l'inscription + 200 Kevs bonus si parrainé
    const initialKevs = referredByUser ? 300 : 100;

    const newUser = await User.create({
        login: normalizedLogin,
        email: normalizedEmail,
        password,
        avatar: defaultAvatar,
        role: assignedRole,
        kevs: initialKevs,
        referredBy: referredByUser ? referredByUser._id : null
    });

    if (referredByUser) {
        referredByUser.kevs = (referredByUser.kevs || 0) + 500;
        await referredByUser.save();
    }

    const { accessToken, refreshToken } = generateTokens(newUser._id);
    
    newUser.refreshTokens.push(refreshToken);
    await newUser.save({ validateBeforeSave: false });

    const userResponse = newUser.toObject();
    userResponse.rank = await calculateUserRank(newUser);
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.loginUser = async (identifier, password) => {
    const normalizedIdentifier = identifier.trim();
    const isEmail = normalizedIdentifier.includes('@');

    const query = isEmail ? { email: normalizedIdentifier.toLowerCase() } : { login: normalizedIdentifier };
    const user = await User.findOne(query).select('+password');

    if (!user) {
        throw new Error('Identifiants invalides');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Identifiants invalides');
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