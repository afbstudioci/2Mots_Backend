// src/controllers/notificationController.js
// GESTION DE L'HISTORIQUE DES NOTIFICATIONS
// STANDARD: Industriel / Bank Grade (Strict <= 270 lignes)

const Notification = require('../models/Notification');

/**
 * Recupere les notifications pagineees de l'utilisateur avec compteur non-lues
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('sender', 'login avatar level')
                .lean(),
            Notification.countDocuments({ recipient: userId }),
            Notification.countDocuments({ recipient: userId, read: false })
        ]);

        return res.status(200).json({
            status: 'success',
            data: {
                notifications,
                unreadCount,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Marque une ou toutes les notifications comme lues
 */
exports.markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const { id } = req.params;

        if (id === 'all') {
            await Notification.updateMany(
                { recipient: userId, read: false },
                { read: true }
            );
            return res.status(200).json({ status: 'success', message: 'Toutes les notifications sont marquees comme lues.' });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ status: 'fail', message: 'Notification introuvable.' });
        }

        return res.status(200).json({ status: 'success', data: notification });
    } catch (error) {
        next(error);
    }
};

/**
 * Supprime une ou toutes les notifications
 */
exports.deleteNotification = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const { id } = req.params;

        if (id === 'all') {
            await Notification.deleteMany({ recipient: userId });
            return res.status(200).json({ status: 'success', message: 'Toutes les notifications ont ete supprimees.' });
        }

        const result = await Notification.findOneAndDelete({ _id: id, recipient: userId });
        if (!result) {
            return res.status(404).json({ status: 'fail', message: 'Notification introuvable.' });
        }

        return res.status(200).json({ status: 'success', message: 'Notification supprimee avec succes.' });
    } catch (error) {
        next(error);
    }
};

/**
 * Enregistre ou met a jour le token push Expo de l'utilisateur
 */
exports.savePushToken = async (req, res, next) => {
    try {
        const { token, platform = 'android', fcmToken, appVersionCode } = req.body;
        const pushToken = token || fcmToken;
        const userId = req.user?.id || req.user?._id;

        const { Expo } = require('expo-server-sdk');
        const User = require('../models/User');

        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            return res.status(400).json({ status: 'fail', message: 'Token Expo Push invalide ou manquant.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur non trouve.' });
        }

        if (!user.pushTokens) {
            user.pushTokens = [];
        }

        const cleanToken = String(pushToken).trim();
        const exists = user.pushTokens.some((t) => t.token === cleanToken);

        if (!exists) {
            user.pushTokens.push({
                token: cleanToken,
                platform: platform || 'android',
                updatedAt: new Date(),
            });
        } else {
            const idx = user.pushTokens.findIndex((t) => t.token === cleanToken);
            if (idx !== -1) user.pushTokens[idx].updatedAt = new Date();
        }

        user.fcmToken = cleanToken;

        if (appVersionCode && Number.isInteger(Number(appVersionCode))) {
            user.appVersionCode = Number(appVersionCode);
        }

        await user.save();

        console.log(`[PUSH] Token enregistre avec succes pour ${user.login} (version: ${user.appVersionCode})`);
        return res.status(200).json({ status: 'success', message: 'Token push enregistre.' });
    } catch (error) {
        console.error('[PUSH_CONTROLLER] Erreur sauvegarde token:', error);
        next(error);
    }
};

/**
 * Diffuse une notification push de mise a jour ciblee aux utilisateurs ayant une version inferieure
 */
exports.broadcastUpdateNotification = async (req, res, next) => {
    try {
        const User = require('../models/User');
        const { sendAndroidPushNotification } = require('../services/expoPushService');

        const adminSecret = req.headers['x-admin-key'];
        const isAdmin =
            req.user?.role === 'admin' ||
            req.user?.role === 'superadmin' ||
            (process.env.ADMIN_SECRET_KEY && adminSecret === process.env.ADMIN_SECRET_KEY);

        if (!isAdmin) {
            return res.status(403).json({ status: 'fail', message: 'Action reservee aux administrateurs.' });
        }

        const targetVersionCode =
            parseInt(req.body?.targetVersionCode, 10) ||
            parseInt(process.env.LATEST_VERSION_CODE, 10) ||
            16;

        const title = req.body?.title || process.env.UPDATE_TITLE || 'Mise à jour disponible';
        const message =
            req.body?.message ||
            process.env.UPDATE_MESSAGE ||
            'Une nouvelle version de 2Mots est disponible sur le Play Store. Mettez à jour votre jeu pour profiter des nouveautés !';
        const storeUrl =
            process.env.STORE_URL ||
            'https://play.google.com/store/apps/details?id=com.afbstudio.twomots';

        // Selectionne uniquement les utilisateurs dont la version est strictement inferieure
        const outdatedUsers = await User.find({
            appVersionCode: { $lt: targetVersionCode },
            $or: [{ 'pushTokens.0': { $exists: true } }, { fcmToken: { $ne: null } }],
        })
            .select('_id')
            .lean();

        const userIds = outdatedUsers.map((u) => u._id);

        if (userIds.length > 0) {
            await sendAndroidPushNotification({
                userIds,
                title,
                body: message,
                data: {
                    type: 'app_update',
                    targetVersionCode: String(targetVersionCode),
                    storeUrl,
                },
            });
        }

        return res.status(200).json({
            status: 'success',
            message: `Notification de mise a jour envoyee a ${userIds.length} utilisateur(s).`,
            data: {
                targetedCount: userIds.length,
                targetVersionCode,
            },
        });
    } catch (error) {
        console.error('[PUSH_UPDATE_BROADCAST] Erreur diffusion:', error);
        next(error);
    }
};

