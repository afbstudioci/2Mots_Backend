//src/controllers/authController.js
const authService = require('../services/authService');

const sendTokenResponse = (res, statusCode, result) => {
    res.status(statusCode).json({
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
        const { login, email, password } = req.body;
        const result = await authService.registerUser(login, email, password);
        sendTokenResponse(res, 201, result);
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { login, password } = req.body;
        const result = await authService.loginUser(login, password);
        sendTokenResponse(res, 200, result);
    } catch (error) {
        res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken: currentRefreshToken } = req.body;
        
        if (!currentRefreshToken) {
            return res.status(401).json({ status: 'fail', message: 'Aucun jeton de rafraîchissement fourni' });
        }

        const result = await authService.refreshUserToken(currentRefreshToken);

        res.status(200).json({ 
            status: 'success', 
            data: { 
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            } 
        });
    } catch (error) {
        res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        await authService.logoutUser(req.user.id);
        res.status(200).json({ status: 'success', message: 'Déconnexion réussie' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la déconnexion' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await authService.getUserProfile(req.user.id);
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        res.status(404).json({ status: 'fail', message: error.message });
    }
};

// NOUVEAU CONTROLEUR : Mise à jour du profil
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { login, email, currentPassword, newPassword } = req.body;
        let avatarUrl = null;

        // Si une image a été uploadée, multer-storage-cloudinary place l'URL sécurisée dans req.file.path
        if (req.file) {
            avatarUrl = req.file.path;
        }

        const updatedUser = await authService.updateUserProfile(userId, {
            login,
            email,
            currentPassword,
            newPassword,
            avatarUrl
        });

        res.status(200).json({ status: 'success', message: 'Profil mis à jour', data: { user: updatedUser } });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const resetToken = await authService.requestPasswordReset(email);
        
        if (!resetToken) {
            return res.status(200).json({ status: 'success', message: 'Si cet email existe, un lien a été envoyé' });
        }

        res.status(200).json({ status: 'success', message: 'Jeton généré', data: { resetToken } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la demande' });
    }
};