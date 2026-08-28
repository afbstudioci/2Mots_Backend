//src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
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
        trim: true,
        maxlength: 120
    },
    body: {
        type: String,
        required: [true, 'Le corps du message est obligatoire.'],
        trim: true,
        maxlength: 500
    },
    type: {
        type: String,
        default: 'general',
        trim: true
    },
    data: {
        type: Object,
        default: {}
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date,
        default: null
    }
}, { timestamps: true, versionKey: false });

// Index TTL de 30 jours (Auto-purge Bank-Grade standard Yély)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Index de recherche rapide paginée par utilisateur
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
