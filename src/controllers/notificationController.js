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
