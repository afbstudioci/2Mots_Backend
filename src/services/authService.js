//src/services/authService.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });

    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    return { accessToken, refreshToken };
};

exports.registerUser = async (login, email, password) => {
    const existingUser = await User.findOne({ $or: [{ email }, { login }] });
    if (existingUser) {
        throw new Error('Un utilisateur avec cet email ou ce pseudo existe deja');
    }

    // Determination du role : Si c'est l'email admin, on lui donne le plein pouvoir
    let assignedRole = 'user';
    if (process.env.ADMIN_MAIL && email.toLowerCase() === process.env.ADMIN_MAIL.toLowerCase()) {
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

    // On ne renvoie pas le mot de passe ni les tokens de rafraichissement dans la reponse publique
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

    // Mise a niveau silencieuse : si l'admin se connecte mais n'avait pas encore le role (ex: variable ajoutee apres coup)
    if (process.env.ADMIN_MAIL && user.email.toLowerCase() === process.env.ADMIN_MAIL.toLowerCase() && user.role !== 'superadmin') {
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

exports.refreshUserToken = async (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        const user = await User.findById(decoded.id);
        if (!user || !user.refreshTokens.includes(refreshToken)) {
            throw new Error('Jeton de rafraichissement invalide ou expire');
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
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