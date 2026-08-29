// src/models/Notification.js
// MODELE DE PERSISTANCE DES NOTIFICATIONS IN-APP
// STANDARD: Industriel / Bank Grade (TTL 30 jours, indexation optimale)

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Le destinataire est obligatoire.'],
            index: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        title: {
            type: String,
            required: [true, 'Le titre est obligatoire.'],
            trim: true
        },
        body: {
            type: String,
            required: [true, 'Le corps du message est obligatoire.'],
            trim: true
        },
        type: {
            type: String,
            enum: [
                'duel_invite',
                'duel_accepted',
                'duel_rejected',
                'chat_message',
                'friend_request',
                'friend_accepted',
                'level_up',
                'mission_complete',
                'general'
            ],
            default: 'general'
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        read: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Indexation pour requetage ultra rapide des listes paginees par utilisateur
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Index TTL : Purge automatique des notifications vieilles de plus de 30 jours (2592000 secondes)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);
