//src/services/authService.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn, adminMail } = require('../config/env');

const generateTokens = (userId) => {
    if (!jwtSecret || !jwtRefreshSecret) {
        throw new Error('Erreur de configuration serveur : Cles JWT manquantes');
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
        throw new Error('Un utilisateur avec cet email ou ce pseudo existe deja');
    }

    let assignedRole = 'user';
    if (adminMail && email.toLowerCase() === adminMail.toLowerCase()) {
        assignedRole = 'superadmin';
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=FF5A5F&color=fff&size=128`;

    const newUser = await User.create({
        login,
        email,
        password,
        avatar: defaultAvatar,
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
        $or: [
            { email: loginIdentifier.toLowerCase() }, 
            { login: { $regex: new RegExp(`^${loginIdentifier}$`, 'i') } }
        ]
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
            throw new Error('Jeton de rafraichissement invalide ou expire');
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        user.refreshTokens = user.refreshTokens.filter(token => token !== currentRefreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
        throw new Error('Session expiree, veuillez vous reconnecter');
    }
};

exports.logoutUser = async (userId) => {
    const user = await User.findById(userId);
    if (user) {
        user.refreshTokens = [];
        await user.save({ validateBeforeSave: false });
    }
};

// --- CONTROLEUR MIS A JOUR : Calcul du rang ---
exports.getUserProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    // Calcul du rang : On compte le nombre de joueurs (non bannis) ayant un score supérieur
    const higherScoringUsersCount = await User.countDocuments({
        isBanned: false,
        bestScore: { $gt: user.bestScore }
    });
    
    // Le rang est le nombre de personnes devant lui + 1
    const rank = higherScoringUsersCount + 1;

    const userResponse = user.toObject();
    userResponse.rank = rank; // On injecte le rang dans la reponse
    
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return userResponse;
};

exports.requestPasswordReset = async (email) => {
    return null;
};

exports.updateUserProfile = async (userId, updateData) => {
    const { login, email, currentPassword, newPassword, avatarUrl } = updateData;
    
    const user = await User.findById(userId).select('+password');
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    if (newPassword) {
        if (!currentPassword) {
            throw new Error('Le mot de passe actuel est requis pour le modifier');
        }
        if (!(await user.comparePassword(currentPassword, user.password))) {
            throw new Error('Le mot de passe actuel est incorrect');
        }
        user.password = newPassword; 
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            throw new Error('Cet email est déjà utilisé par un autre compte');
        }
        user.email = email.toLowerCase();
    }

    if (login && login.toLowerCase() !== user.login.toLowerCase()) {
        const existingLogin = await User.findOne({ login: { $regex: new RegExp(`^${login}$`, 'i') } });
        if (existingLogin) {
            throw new Error('Ce pseudo est déjà pris');
        }
        user.login = login;
    }

    if (avatarUrl) {
        user.avatar = avatarUrl;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return userResponse;
};