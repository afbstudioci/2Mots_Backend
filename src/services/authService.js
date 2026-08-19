//src/services/authService.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
const adminMail = process.env.ADMIN_MAIL;

const generateTokens = (userId) => {
    if (!jwtSecret || !jwtRefreshSecret) {
        throw new Error('Variables JWT manquantes');
    }
    const accessToken = jwt.sign({ id: userId }, jwtSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, jwtRefreshSecret, { expiresIn: '30d' });
    return { accessToken, refreshToken };
};

const calculateUserRank = async (userDoc) => {
    if (!userDoc) return 1;
    const lvl = userDoc.level || 1;
    const exp = userDoc.xp || 0;
    const score = userDoc.bestScore || 0;

    const higher = await User.countDocuments({
        isBanned: false,
        _id: { $ne: userDoc._id },
        $or: [
            { level: { $gt: lvl } },
            { level: lvl, xp: { $gt: exp } },
            { level: lvl, xp: exp, bestScore: { $gt: score } }
        ]
    });
    return higher + 1;
};

exports.registerUser = async (login, email, password, referredByCode = null) => {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedLogin = login.trim();

    const existingUser = await User.findOne({ 
        $or: [
            { email: normalizedEmail }, 
            { login: { $regex: new RegExp(`^${normalizedLogin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
        ] 
    });

    if (existingUser) {
        if (existingUser.email === normalizedEmail) {
            throw new Error('Cet email est deja utilise');
        }
        throw new Error('Ce pseudo est deja pris');
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

    const newUser = await User.create({
        login: normalizedLogin,
        email: normalizedEmail,
        password,
        avatar: defaultAvatar,
        role: assignedRole,
        referredBy: referredByUser ? referredByUser._id : null
    });

    const { accessToken, refreshToken } = generateTokens(newUser._id);
    
    newUser.refreshTokens.push(refreshToken);
    await newUser.save({ validateBeforeSave: false });

    const userResponse = newUser.toObject();
    userResponse.rank = await calculateUserRank(newUser);
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.loginUser = async (loginIdentifier, password) => {
    const normalizedIdentifier = loginIdentifier.trim();
    
    const user = await User.findOne({
        $or: [
            { email: normalizedIdentifier.toLowerCase() }, 
            { login: { $regex: new RegExp(`^${normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
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
    userResponse.rank = await calculateUserRank(user);
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return { user: userResponse, accessToken, refreshToken };
};

exports.loginWithGoogle = async ({ email, name, profilePicture, mode = 'login' }) => {
    if (!email) throw new Error('Email Google manquant');
    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user && mode === 'login') {
        throw new Error('Aucun compte 2Mots associe a ce Gmail, veuillez vous inscrire.');
    }

    if (!user) {
        let baseLogin = (name || normalizedEmail.split('@')[0])
            .replace(/[^a-zA-Z0-9_]/g, '')
            .substring(0, 14);
        if (!baseLogin) baseLogin = 'Joueur';

        let uniqueLogin = baseLogin;
        let counter = 1;
        while (await User.findOne({ login: { $regex: new RegExp(`^${uniqueLogin}$`, 'i') } })) {
            uniqueLogin = `${baseLogin}${counter}`;
            counter++;
        }

        const defaultAvatar = profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(uniqueLogin)}&background=FF5A5F&color=fff&size=128`;
        const randomPassword = Math.random().toString(36).slice(-10) + 'A1!';

        user = await User.create({
            login: uniqueLogin,
            email: normalizedEmail,
            password: randomPassword,
            avatar: defaultAvatar,
            role: (adminMail && normalizedEmail === adminMail.toLowerCase()) ? 'superadmin' : 'user',
            kevs: 100
        });
    } else {
        if (profilePicture && (!user.avatar || user.avatar.includes('ui-avatars.com'))) {
            user.avatar = profilePicture;
        }
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

exports.getUserProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const rank = await calculateUserRank(user);
    const userResponse = user.toObject();
    userResponse.rank = rank;
    
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
            throw new Error('Cet email est deja utilise par un autre compte');
        }
        user.email = email.toLowerCase();
    }

    if (login && login.toLowerCase() !== user.login.toLowerCase()) {
        const existingLogin = await User.findOne({ login: { $regex: new RegExp(`^${login}$`, 'i') } });
        if (existingLogin) {
            throw new Error('Ce pseudo est deja pris');
        }
        user.login = login;
    }

    if (avatarUrl) {
        user.avatar = avatarUrl;
    }

    await user.save();

    const userResponse = user.toObject();
    userResponse.rank = await calculateUserRank(user);
    delete userResponse.password;
    delete userResponse.refreshTokens;

    return userResponse;
};