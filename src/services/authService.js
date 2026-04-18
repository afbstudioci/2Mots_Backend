const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { jwtSecret, jwtRefreshSecret } = require('../config/env');

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, jwtRefreshSecret, { expiresIn: '180d' });
    return { accessToken, refreshToken };
};

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const registerUser = async (username, email, password) => {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new Error('Ce pseudo ou cet email est deja utilise');
    }

    const newUser = await User.create({ username, email, password });
    const { accessToken, refreshToken } = generateTokens(newUser._id);
    
    const hashedRefreshToken = hashToken(refreshToken);
    newUser.refreshTokens.push({ token: hashedRefreshToken });
    await newUser.save({ validateBeforeSave: false });

    return { user: { id: newUser._id, username: newUser.username }, accessToken, refreshToken };
};

const loginUser = async (login, password) => {
    const user = await User.findOne({ $or: [{ username: login }, { email: login }] }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        throw new Error('Identifiants incorrects');
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    const hashedRefreshToken = hashToken(refreshToken);
    
    user.refreshTokens = [{ token: hashedRefreshToken }];
    await user.save({ validateBeforeSave: false });

    return { user: { id: user._id, username: user.username }, accessToken, refreshToken };
};

const refreshUserToken = async (currentRefreshToken) => {
    const decoded = jwt.verify(currentRefreshToken, jwtRefreshSecret);
    const hashedToken = hashToken(currentRefreshToken);

    const user = await User.findOne({ _id: decoded.id, 'refreshTokens.token': hashedToken });
    if (!user) {
        throw new Error('Session expiree, veuillez vous reconnecter');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    const newHashedToken = hashToken(newRefreshToken);

    user.refreshTokens = user.refreshTokens.filter(t => t.token !== hashedToken);
    user.refreshTokens.push({ token: newHashedToken });
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken: newRefreshToken };
};

const logoutUser = async (user) => {
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
};

const requestPasswordReset = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        return null; // Le controller gérera le message neutre pour éviter l'ENUM
    }

    const resetToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '10m' });
    // En production : envoi d'email ici (ex: SendGrid)
    return resetToken;
};

module.exports = {
    registerUser,
    loginUser,
    refreshUserToken,
    logoutUser,
    requestPasswordReset
};