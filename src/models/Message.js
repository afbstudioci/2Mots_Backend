const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio'],
        default: 'text'
    },
    fileUrl: {
        type: String
    },
    fileId: {
        type: String // Cloudinary public_id
    },
    duration: {
        type: Number // Pour les audios/vidéos en secondes
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
