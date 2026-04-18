const authService = require('../services/authService');

// Fonction utilitaire pour attacher le cookie httpOnly
const sendTokenResponse = (res, statusCode, result) => {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true, // Impossible d'accéder à ce cookie via JavaScript (sécurité anti-XSS)
        secure: isProduction, // Sur HTTPS uniquement en production
        sameSite: isProduction ? 'none' : 'lax', // 'none' requis si le front et l'API sont sur des domaines différents en prod
        maxAge: 180 * 24 * 60 * 60 * 1000 // 180 jours
    });

    // On ne renvoie QUE l'accessToken et les infos user dans le JSON
    res.status(statusCode).json({
        status: 'success',
        data: {
            user: result.user,
            accessToken: result.accessToken
        }
    });
};

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.registerUser(username, email, password);
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
        // Le refreshToken est maintenant récupéré de manière sécurisée via le cookie, pas le body
        const currentRefreshToken = req.cookies.refreshToken;
        
        if (!currentRefreshToken) {
            return res.status(401).json({ status: 'fail', message: 'Aucun jeton de rafraîchissement fourni' });
        }

        const result = await authService.refreshUserToken(currentRefreshToken);
        
        // On renvoie le nouveau refreshToken dans un nouveau cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 180 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({ 
            status: 'success', 
            data: { accessToken: result.accessToken } 
        });
    } catch (error) {
        // Si le token est invalide, on efface le cookie malveillant/périmé
        res.clearCookie('refreshToken');
        res.status(401).json({ status: 'fail', message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        await authService.logoutUser(req.user);
        res.clearCookie('refreshToken'); // Nettoyage côté client
        res.status(200).json({ status: 'success', message: 'Déconnexion réussie' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la déconnexion' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const resetToken = await authService.requestPasswordReset(email);
        
        if (!resetToken) {
            return res.status(200).json({ status: 'success', message: 'Si cet email existe, un lien a été envoyé' });
        }

        res.status(200).json({ status: 'success', message: 'Token généré', data: { resetToken } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erreur lors de la demande' });
    }
};