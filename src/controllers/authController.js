//src/controllers/authController.js
const authService = require('../services/authService');
const cloudinary = require('../config/cloudinary');
const { registerSchema, loginSchema } = require('../middlewares/validators');
const { z } = require('zod');

const sendTokenResponse = (res, statusCode, result) => {
    return res.status(statusCode).json({
        status: 'success',
        data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        }
    });
};

exports.register = async (req, res) => {
    try {
        const validatedData = await registerSchema.parseAsync(req.body);
        const { login, email, password } = validatedData;
        const referralCode = (req.body.referralCode && typeof req.body.referralCode === 'string') 
            ? req.body.referralCode.trim() 
            : null;
        const result = await authService.registerUser(login, email, password, referralCode);
        return sendTokenResponse(res, 201, result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map(e => e.message);
            return res.status(400).json({ status: 'fail', message: errors[0] });
        }
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const validatedData = await loginSchema.parseAsync(req.body);
        const { login, password } = validatedData;
        const result = await authService.loginUser(login, password);
        return sendTokenResponse(res, 200, result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map(e => e.message);
            return res.status(400).json({ status: 'fail', message: errors[0] });
        }
        return res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.googleAuth = async (req, res) => {
    try {
        const { email, name, profilePicture, mode } = req.body;
        if (!email) {
            return res.status(400).json({ status: 'fail', message: 'Email requis pour Google Sign-In.' });
        }
        const result = await authService.loginWithGoogle({ email, name, profilePicture, mode });
        return sendTokenResponse(res, 200, result);
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken: currentRefreshToken } = req.body;
        if (!currentRefreshToken) {
            return res.status(401).json({ status: 'fail', message: 'Aucun jeton de rafrachissement fourni.' });
        }
        const result = await authService.refreshUserToken(currentRefreshToken);
        return res.status(200).json({
            status: 'success',
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });
    } catch (error) {
        return res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        await authService.logoutUser(req.user.id);
        return res.status(200).json({ status: 'success', message: 'Dconnexion russie.' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur lors de la dconnexion.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await authService.getUserProfile(req.user.id);
        return res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        return res.status(404).json({ status: 'fail', message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { login, email, currentPassword, newPassword } = req.body;
        let avatarUrl = null;

        if (req.file) {
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: '2mots_avatars',
                        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                        transformation: [{ width: 500, height: 500, crop: 'limit' }]
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });
            avatarUrl = uploadResult.secure_url;
        }

        const updatedUser = await authService.updateUserProfile(userId, {
            login,
            email,
            currentPassword,
            newPassword,
            avatarUrl
        });

        return res.status(200).json({ status: 'success', message: 'Profil mis  jour avec succs.', data: { user: updatedUser } });
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const resetToken = await authService.requestPasswordReset(email);
        if (!resetToken) {
            return res.status(200).json({ status: 'success', message: 'Si cette adresse e-mail existe, un lien a t envoy.' });
        }
        return res.status(200).json({ status: 'success', message: 'Jeton de rinitialisation gnr.', data: { resetToken } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur lors de la demande de rinitialisation.' });
    }
};

exports.updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const User = require('../models/User');
        if (fcmToken && req.user?.id) {
            await User.findByIdAndUpdate(req.user.id, { fcmToken });
        }
        return res.status(200).json({ status: 'success', message: 'Token FCM synchronis.' });
    } catch (error) {
        return res.status(400).json({ status: 'fail', message: error.message });
    }
};
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const User = require('../models/User');
        const Friendship = require('../models/Friendship');
        const UserMission = require('../models/UserMission');
        const Message = require('../models/Message');

        await Promise.all([
            Friendship.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] }),
            UserMission.deleteMany({ userId }),
            Message.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
            User.findByIdAndDelete(userId)
        ]);

        return res.status(200).json({ status: 'success', message: 'Compte supprimé définitivement.' });
    } catch (error) {
        console.error('[AUTH] Erreur suppression compte:', error);
        return res.status(500).json({ status: 'error', message: 'Erreur lors de la suppression du compte.' });
    }
};