const authService = require('../services/authService');

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.registerUser(username, email, password);
        res.status(201).json({ status: 'success', data: result });
    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { login, password } = req.body;
        const result = await authService.loginUser(login, password);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authService.refreshUserToken(refreshToken);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        await authService.logoutUser(req.user);
        res.status(200).json({ status: 'success', message: 'Deconnexion reussie' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la deconnexion' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const resetToken = await authService.requestPasswordReset(email);
        
        if (!resetToken) {
            return res.status(200).json({ status: 'success', message: 'Si cet email existe, un lien a ete envoye' });
        }

        res.status(200).json({ status: 'success', message: 'Token genere', data: { resetToken } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la demande' });
    }
};